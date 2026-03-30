import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  GripVertical,
  Loader2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  ImageIcon,
  Camera,
} from "lucide-react";
import {
  fetchAllMenuItems,
  updateMenuItem,
  insertMenuItem,
  deleteMenuItem,
  batchUpdateSortOrder,
  updateRestaurantCategories,
  renameCategory,
  updateRestaurant,
  uploadMenuItemImage,
  deleteMenuItemImage,
} from "@/lib/api";
import { resizeImageForMenu } from "@/lib/image";
import { detectAlcohol } from "@/lib/alcoholDetection";
import type { DbRestaurant, DbMenuItem, Supplement } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MenuImportModal } from "@/components/dashboard/MenuImportModal";

interface Props {
  restaurant: DbRestaurant;
  isDemo?: boolean;
}

// Sortable item row
function SortableItemRow({
  item,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  item: DbMenuItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 bg-card rounded-xl border border-border p-3 transition-opacity ${!item.enabled ? "opacity-50" : ""}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 shrink-0">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      {item.image && (
        <img src={item.image} alt={item.name} className="h-10 w-10 rounded-lg object-cover shrink-0" loading="lazy" />
      )}
      {!item.image && (
        <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
        {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
        {((item.variants ?? []).length > 0 || (item.sauces ?? []).length > 0 || (item.supplements ?? []).length > 0 || item.is_alcohol) && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {(item.variants ?? []).length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                {t("dashboard.menu.sizes_count", { count: String((item.variants ?? []).length) })}
              </span>
            )}
            {(item.sauces ?? []).length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                {t("dashboard.menu.sauces_count", { count: String((item.sauces ?? []).length) })}
              </span>
            )}
            {(item.supplements ?? []).length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                {t("dashboard.menu.supplements_short", { count: String((item.supplements ?? []).length) })}
              </span>
            )}
            {item.is_alcohol && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                {t('dashboard.menu.alcohol_badge')}
              </span>
            )}
          </div>
        )}
      </div>
      <span className="text-sm font-bold text-foreground shrink-0">{Number(item.price).toFixed(2)} €</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <Switch checked={item.enabled} onCheckedChange={onToggle} className="scale-75" />
        <button onClick={onDuplicate} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title={t('dashboard.menu.duplicate')}>
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </button>
      </div>
    </div>
  );
}

// Sortable category header
function SortableCategoryHeader({
  name,
  itemCount,
  expanded,
  onToggleExpand,
  onRename,
  onDelete,
}: {
  name: string;
  itemCount: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: `cat-${name}` });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-secondary/80 rounded-xl px-3 py-2.5"
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 shrink-0">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <button onClick={onToggleExpand} className="p-1 shrink-0">
        {expanded ? <ChevronDown className="h-4 w-4 text-foreground" /> : <ChevronRight className="h-4 w-4 text-foreground rtl:scale-x-[-1]" />}
      </button>
      <span className="flex-1 text-sm font-semibold text-foreground">{name}</span>
      <span className="text-xs text-muted-foreground me-2">{itemCount} {t('dashboard.menu.items_count')}</span>
      <button onClick={onRename} className="p-1.5 rounded-lg hover:bg-background/50 transition-colors">
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </button>
    </div>
  );
}

export const DashboardMaCarte = ({ restaurant, isDemo }: Props) => {
  const { t } = useLanguage();
  const [items, setItems] = useState<DbMenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(restaurant.categories ?? []);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editItem, setEditItem] = useState<DbMenuItem | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    price: "",
    category: categories[0] || "",
    image: "",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadItems = useCallback(async () => {
    const data = await fetchAllMenuItems(restaurant.id);
    setItems(data);
    setLoading(false);
    // Initialize all categories as expanded
    const exp: Record<string, boolean> = {};
    (restaurant.categories ?? []).forEach((c) => { exp[c] = true; });
    setExpanded(exp);
  }, [restaurant.id, restaurant.categories]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const toggleItem = async (id: string, enabled: boolean) => {
    if (isDemo) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, enabled: !enabled } : i)));
      return;
    }
    await updateMenuItem(id, { enabled: !enabled });
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, enabled: !enabled } : i)));
  };

  const handleDuplicateItem = async (item: DbMenuItem) => {
    if (isDemo) {
      const demoId = crypto.randomUUID();
      const copy = { ...item, id: demoId, name: item.name + t('dashboard.menu.copy_suffix') };
      setItems((prev) => [...prev, copy]);
      toast.success(t('dashboard.menu.item_duplicated'));
      return;
    }
    try {
      await insertMenuItem({
        restaurant_id: restaurant.id,
        name: item.name + t('dashboard.menu.copy_suffix'),
        description: item.description,
        price: item.price,
        category: item.category,
        image: item.image || undefined,
        supplements: item.supplements,
        sauces: item.sauces,
        variants: item.variants,
      });
      const data = await fetchAllMenuItems(restaurant.id);
      setItems(data);
      toast.success(t('dashboard.menu.item_duplicated'));
    } catch {
      toast.error(t('dashboard.menu.duplicate_error'));
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm(t('dashboard.menu.delete_item_confirm'))) return;
    if (isDemo) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success(t('dashboard.menu.item_deleted'));
      return;
    }
    await deleteMenuItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success(t('dashboard.menu.item_deleted'));
  };

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.price) return;
    if (isDemo) {
      const demoId = crypto.randomUUID();
      setItems((prev) => [...prev, {
        id: demoId,
        restaurant_id: restaurant.id,
        name: newItem.name,
        description: newItem.description,
        price: parseFloat(newItem.price),
        category: newItem.category,
        image: newItem.image || "",
        enabled: true,
        popular: false,
        sort_order: items.length,
        supplements: [],
        sauces: [],
        product_type: "simple",
      } as DbMenuItem]);
      setNewItem({ name: "", description: "", price: "", category: categories[0] || "", image: "" });
      setShowAddItem(false);
      toast.success(t('dashboard.menu.item_added'));
      return;
    }
    await insertMenuItem({
      restaurant_id: restaurant.id,
      name: newItem.name,
      description: newItem.description,
      price: parseFloat(newItem.price),
      category: newItem.category,
      image: newItem.image || undefined,
    });
    const data = await fetchAllMenuItems(restaurant.id);
    setItems(data);
    setNewItem({ name: "", description: "", price: "", category: categories[0] || "", image: "" });
    setShowAddItem(false);
    toast.success(t('dashboard.menu.item_added'));
  };

  const handleEditSave = async () => {
    if (!editItem) return;
    if (isDemo) {
      const cleaned = {
        ...editItem,
        variants: (editItem.variants ?? []).filter((v) => v.name.trim()),
        sauces: (editItem.sauces ?? []).filter((s) => s.trim()),
        supplements: (editItem.supplements ?? []).filter((s) => s.name.trim()),
      };
      if (cleaned.variants.length === 0) cleaned.variants = undefined as any;
      setItems((prev) => prev.map((i) => (i.id === editItem.id ? cleaned : i)));
      setEditItem(null);
      toast.success(t('dashboard.menu.item_modified'));
      return;
    }
    // Filter out empty variants/sauces/supplements before saving
    const cleanVariants = (editItem.variants ?? []).filter((v) => v.name.trim());
    const cleanSauces = (editItem.sauces ?? []).filter((s) => s.trim());
    const cleanSupplements = (editItem.supplements ?? []).filter((s) => s.name.trim());
    await updateMenuItem(editItem.id, {
      name: editItem.name,
      description: editItem.description,
      price: editItem.price,
      image: editItem.image,
      popular: editItem.popular,
      product_type: editItem.product_type || "simple",
      variants: cleanVariants.length > 0 ? cleanVariants : null,
      sauces: cleanSauces,
      supplements: cleanSupplements,
      is_alcohol: editItem.is_alcohol ?? false,
    });
    setItems((prev) => prev.map((i) => (i.id === editItem.id ? editItem : i)));
    setEditItem(null);
    toast.success(t('dashboard.menu.item_modified'));
  };

  const handleImageUpload = async (file: File, itemId: string) => {
    setUploadingImage(true);
    if (isDemo) {
      // Use local object URL for demo (no storage upload)
      const url = URL.createObjectURL(file);
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, image: url } : i)));
      if (editItem?.id === itemId) setEditItem((prev) => prev ? { ...prev, image: url } : prev);
      toast.success(t('dashboard.menu.photo_added'));
      setUploadingImage(false);
      return;
    }
    try {
      const blob = await resizeImageForMenu(file);
      const url = await uploadMenuItemImage(restaurant.id, itemId, blob);
      await updateMenuItem(itemId, { image: url });
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, image: url } : i)));
      if (editItem?.id === itemId) setEditItem((prev) => prev ? { ...prev, image: url } : prev);
      toast.success(t('dashboard.menu.photo_added'));
    } catch (e) {
      console.error("Image upload error:", e);
      toast.error(t('common.toast.upload_error'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageDelete = async (itemId: string) => {
    if (isDemo) {
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, image: "" } : i)));
      if (editItem?.id === itemId) setEditItem((prev) => prev ? { ...prev, image: "" } : prev);
      toast.success(t('dashboard.menu.photo_deleted'));
      return;
    }
    try {
      await deleteMenuItemImage(restaurant.id, itemId);
      await updateMenuItem(itemId, { image: null });
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, image: "" } : i)));
      if (editItem?.id === itemId) setEditItem((prev) => prev ? { ...prev, image: "" } : prev);
      toast.success(t('dashboard.menu.photo_deleted'));
    } catch (e) {
      console.error("Image delete error:", e);
      toast.error(t('common.toast.delete_error'));
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const updated = [...categories, newCategoryName.trim()];
    setCategories(updated);
    setExpanded((prev) => ({ ...prev, [newCategoryName.trim()]: true }));
    setNewCategoryName("");
    setShowAddCategory(false);
    toast.success(t('dashboard.menu.category_added'));
    if (isDemo) return;
    await updateRestaurantCategories(restaurant.id, updated);
  };

  const handleRenameCategory = async () => {
    if (!renamingCategory || !renameValue.trim()) return;
    const oldName = renamingCategory;
    const newName = renameValue.trim();
    const updated = categories.map((c) => (c === oldName ? newName : c));
    setCategories(updated);
    setItems((prev) => prev.map((i) => (i.category === oldName ? { ...i, category: newName } : i)));
    setExpanded((prev) => {
      const n = { ...prev };
      n[newName] = n[oldName] ?? true;
      delete n[oldName];
      return n;
    });
    setRenamingCategory(null);
    setRenameValue("");
    toast.success(t('dashboard.menu.category_renamed'));
    if (isDemo) return;
    await renameCategory(restaurant.id, oldName, newName);
    await updateRestaurantCategories(restaurant.id, updated);
  };

  const handleDeleteCategory = async (cat: string) => {
    const catItems = items.filter((i) => i.category === cat);
    if (catItems.length > 0 && !confirm(t('dashboard.menu.delete_category_items_confirm', { name: cat, count: String(catItems.length) }))) return;
    if (catItems.length === 0 && !confirm(t('dashboard.menu.delete_category_confirm', { name: cat }))) return;
    const updated = categories.filter((c) => c !== cat);
    setCategories(updated);
    setItems((prev) => prev.filter((i) => i.category !== cat));
    toast.success(t('dashboard.menu.category_deleted'));
    if (isDemo) return;
    for (const item of catItems) {
      await deleteMenuItem(item.id);
    }
    await updateRestaurantCategories(restaurant.id, updated);
  };

  // DnD for categories
  const handleCategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.indexOf(String(active.id).replace("cat-", ""));
    const newIndex = categories.indexOf(String(over.id).replace("cat-", ""));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(categories, oldIndex, newIndex);
    setCategories(reordered);
    if (isDemo) return;
    await updateRestaurantCategories(restaurant.id, reordered);
  };

  // DnD for items within a category
  const handleItemDragEnd = async (event: DragEndEvent, cat: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const catItems = items
      .filter((i) => i.category === cat)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const oldIndex = catItems.findIndex((i) => i.id === active.id);
    const newIndex = catItems.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(catItems, oldIndex, newIndex);
    const updates = reordered.map((item, i) => ({ id: item.id, sort_order: i }));

    // Optimistic update
    setItems((prev) => {
      const rest = prev.filter((i) => i.category !== cat);
      return [...rest, ...reordered.map((item, i) => ({ ...item, sort_order: i }))];
    });

    if (isDemo) return;
    await batchUpdateSortOrder(updates);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Actions bar */}
      <div className="flex items-center gap-2 mb-4">
        <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={() => setShowAddCategory(true)}>
          <Plus className="h-4 w-4" />{t('dashboard.menu.category')}
        </Button>
        <Button size="sm" className="rounded-xl gap-1" onClick={() => { setNewItem((n) => ({ ...n, category: categories[0] || "" })); setShowAddItem(true); }}>
          <Plus className="h-4 w-4" />{t('dashboard.menu.item')}
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => setShowImport(true)}>
          <Camera className="h-4 w-4" />{t('dashboard.menu.import')}
        </Button>
        {items.some((i) => !i.image) && (
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={async () => {
            const { autoAssignStockPhotos } = await import("@/lib/api");
            const count = await autoAssignStockPhotos(restaurant.id);
            if (count > 0) {
              loadItems();
              alert(`${count} photo${count > 1 ? "s" : ""} ajoutee${count > 1 ? "s" : ""} automatiquement`);
            } else {
              alert("Aucune photo stock disponible pour vos produits");
            }
          }}>
            <ImageIcon className="h-4 w-4" />Photos auto
          </Button>
        )}
      </div>

      {/* Photo tips */}
      {!isDemo && items.some((i) => !i.image) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1">
          <p className="text-sm font-medium text-amber-900">Astuce photos</p>
          <p className="text-xs text-amber-800">
            Cliquez "Photos auto" pour ajouter des photos de notre bibliotheque. Vous pouvez aussi prendre vos propres photos : elles seront uniques et donneront encore plus envie.
            Pas de photographe ? Contactez-nous, on peut vous aider.
          </p>
          <p className="text-xs text-amber-700 italic">
            Vous pouvez aussi choisir de ne pas afficher de photos dans Parametres.
          </p>
        </div>
      )}

      {/* Categories DnD */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
        <SortableContext items={categories.map((c) => `cat-${c}`)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {categories.map((cat) => {
              const catItems = items
                .filter((i) => i.category === cat)
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
              const isExpanded = expanded[cat] ?? true;

              return (
                <div key={cat} className="space-y-2">
                  {renamingCategory === cat ? (
                    <div className="flex items-center gap-2 bg-secondary/80 rounded-xl px-3 py-2.5">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRenameCategory()}
                        className="h-8 text-sm flex-1"
                        autoFocus
                      />
                      <button onClick={handleRenameCategory} className="p-1.5 rounded-lg hover:bg-background/50">
                        <Check className="h-4 w-4 text-foreground" />
                      </button>
                      <button onClick={() => setRenamingCategory(null)} className="p-1.5 rounded-lg hover:bg-background/50">
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <SortableCategoryHeader
                      name={cat}
                      itemCount={catItems.length}
                      expanded={isExpanded}
                      onToggleExpand={() => setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                      onRename={() => { setRenamingCategory(cat); setRenameValue(cat); }}
                      onDelete={() => handleDeleteCategory(cat)}
                    />
                  )}

                  {isExpanded && (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => handleItemDragEnd(e, cat)}
                    >
                      <SortableContext items={catItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        <div className="ms-4 space-y-1.5">
                          {catItems.map((item) => (
                            <SortableItemRow
                              key={item.id}
                              item={item}
                              onToggle={() => toggleItem(item.id, item.enabled)}
                              onEdit={() => setEditItem(item)}
                              onDelete={() => handleDeleteItem(item.id)}
                              onDuplicate={() => handleDuplicateItem(item)}
                            />
                          ))}
                          {catItems.length === 0 && (
                            <p className="text-xs text-muted-foreground py-3 text-center">{t('dashboard.menu.no_items_in_category')}</p>
                          )}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {categories.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">{t('dashboard.menu.no_categories')}</p>
        </div>
      )}

      {/* Add category dialog */}
      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t('dashboard.menu.add_category')}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder={t('dashboard.menu.category_name')}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
            />
            <Button onClick={handleAddCategory} className="w-full rounded-xl">{t('common.add')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add item dialog */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t('dashboard.menu.add_product')}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <select
              value={newItem.category}
              onChange={(e) => setNewItem((n) => ({ ...n, category: e.target.value }))}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <Input placeholder={t('dashboard.menu.product_name')} value={newItem.name} onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))} />
            <Input placeholder={t('dashboard.menu.description_optional')} value={newItem.description} onChange={(e) => setNewItem((n) => ({ ...n, description: e.target.value }))} />
            <Input type="number" step="0.50" placeholder={t('dashboard.menu.price_eur')} value={newItem.price} onChange={(e) => setNewItem((n) => ({ ...n, price: e.target.value }))} />
            <p className="text-xs text-muted-foreground">{t('dashboard.menu.photo_after_creation')}</p>
            <Button onClick={handleAddItem} className="w-full rounded-xl">{t('dashboard.menu.add_to_menu')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit item dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('dashboard.menu.edit_product')}</DialogTitle></DialogHeader>
          {editItem && (
            <div className="space-y-4 mt-2">
              <Input value={editItem.name} onChange={(e) => {
                const name = e.target.value;
                const autoAlcohol = detectAlcohol(name);
                setEditItem({ ...editItem, name, is_alcohol: autoAlcohol || editItem.is_alcohol });
              }} placeholder={t('common.name')} />
              <Input value={editItem.description} onChange={(e) => setEditItem({ ...editItem, description: e.target.value })} placeholder={t('common.description')} />
              <Input type="number" step="0.50" value={editItem.price} onChange={(e) => setEditItem({ ...editItem, price: parseFloat(e.target.value) || 0 })} placeholder={t('common.price')} />

              {/* Photo upload */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{t('dashboard.menu.photo')}</p>
                {editItem.image ? (
                  <div className="flex items-center gap-3">
                    <img src={editItem.image} alt="" className="h-16 w-16 rounded-xl object-cover" />
                    <div className="flex gap-2">
                      <label className="cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                        {t('dashboard.menu.change')}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleImageUpload(f, editItem.id);
                          }}
                        />
                      </label>
                      <button
                        onClick={() => handleImageDelete(editItem.id)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors w-fit">
                    {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    {uploadingImage ? t('dashboard.menu.uploading') : t('dashboard.menu.add_photo')}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f, editItem.id);
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Product type */}
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{t('dashboard.menu.product_type')}</p>
                <select
                  value={editItem.product_type || "simple"}
                  onChange={(e) => setEditItem({ ...editItem, product_type: e.target.value })}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="simple">{t('dashboard.menu.type_simple')}</option>
                  <option value="sandwich_personnalisable">{t('dashboard.menu.type_custom_sandwich')}</option>
                  <option value="sandwich_simple">{t('dashboard.menu.type_simple_sandwich')}</option>
                  <option value="menu">{t('dashboard.menu.type_menu')}</option>
                  <option value="accompagnement">{t('dashboard.menu.type_side')}</option>
                  <option value="boisson">{t('dashboard.menu.type_drink')}</option>
                  <option value="dessert">{t('dashboard.menu.type_dessert')}</option>
                  <option value="supplement">{t('dashboard.menu.type_supplement')}</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">{t('menu.popular')}</span>
                <Switch checked={editItem.popular} onCheckedChange={(v) => setEditItem({ ...editItem, popular: v })} />
              </div>

              {/* Alcohol flag */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-foreground">{t('dashboard.menu.alcohol_label')}</span>
                  <p className="text-xs text-muted-foreground">{t('dashboard.menu.alcohol_desc')}</p>
                </div>
                <Switch checked={editItem.is_alcohol ?? false} onCheckedChange={(v) => setEditItem({ ...editItem, is_alcohol: v })} />
              </div>

              {/* ── Variants editor ── */}
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{t("dashboard.customization.sizes_label")}</p>
                  <button
                    onClick={() => setEditItem({
                      ...editItem,
                      variants: [...(editItem.variants ?? []), { name: "", price: editItem.price }],
                    })}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> {t("dashboard.customization.add")}
                  </button>
                </div>
                {(editItem.variants ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">{t("dashboard.customization.no_variants")}</p>
                )}
                {(editItem.variants ?? []).map((v, vi) => (
                  <div key={vi} className="flex items-center gap-2">
                    <Input
                      value={v.name}
                      onChange={(e) => {
                        const arr = [...(editItem.variants ?? [])];
                        arr[vi] = { ...arr[vi], name: e.target.value };
                        setEditItem({ ...editItem, variants: arr });
                      }}
                      placeholder={t("dashboard.customization.variant_name")}
                      className="flex-1 h-9 text-sm"
                    />
                    <Input
                      type="number"
                      step="0.50"
                      value={v.price}
                      onChange={(e) => {
                        const arr = [...(editItem.variants ?? [])];
                        arr[vi] = { ...arr[vi], price: parseFloat(e.target.value) || 0 };
                        setEditItem({ ...editItem, variants: arr });
                      }}
                      placeholder={t("dashboard.customization.variant_price")}
                      className="w-20 h-9 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">€</span>
                    <button
                      onClick={() => {
                        const arr = (editItem.variants ?? []).filter((_, i) => i !== vi);
                        setEditItem({ ...editItem, variants: arr });
                      }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>

              {/* ── Sauces editor ── */}
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{t("dashboard.customization.sauces_section")}</p>
                  <button
                    onClick={() => setEditItem({
                      ...editItem,
                      sauces: [...(editItem.sauces ?? []), ""],
                    })}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> {t("dashboard.customization.add")}
                  </button>
                </div>
                {(editItem.sauces ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">{t("dashboard.customization.no_sauces")}</p>
                )}
                {(editItem.sauces ?? []).map((sauce, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <Input
                      value={sauce}
                      onChange={(e) => {
                        const arr = [...(editItem.sauces ?? [])];
                        arr[si] = e.target.value;
                        setEditItem({ ...editItem, sauces: arr });
                      }}
                      placeholder={t("dashboard.customization.sauce_name")}
                      className="flex-1 h-9 text-sm"
                    />
                    <button
                      onClick={() => {
                        const arr = (editItem.sauces ?? []).filter((_, i) => i !== si);
                        setEditItem({ ...editItem, sauces: arr });
                      }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>

              {/* ── Supplements editor ── */}
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{t("dashboard.customization.supplements_section")}</p>
                  <button
                    onClick={() => setEditItem({
                      ...editItem,
                      supplements: [...(editItem.supplements ?? []), { id: crypto.randomUUID(), name: "", price: 0 }],
                    })}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> {t("dashboard.customization.add")}
                  </button>
                </div>
                {(editItem.supplements ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">{t("dashboard.customization.no_supplements")}</p>
                )}
                {(editItem.supplements ?? []).map((sup, si) => (
                  <div key={sup.id} className="flex items-center gap-2">
                    <Input
                      value={sup.name}
                      onChange={(e) => {
                        const arr = [...(editItem.supplements ?? [])];
                        arr[si] = { ...arr[si], name: e.target.value };
                        setEditItem({ ...editItem, supplements: arr });
                      }}
                      placeholder={t("dashboard.customization.supplement_name")}
                      className="flex-1 h-9 text-sm"
                    />
                    <Input
                      type="number"
                      step="0.50"
                      value={sup.price}
                      onChange={(e) => {
                        const arr = [...(editItem.supplements ?? [])];
                        arr[si] = { ...arr[si], price: parseFloat(e.target.value) || 0 };
                        setEditItem({ ...editItem, supplements: arr });
                      }}
                      placeholder={t("dashboard.customization.variant_price")}
                      className="w-20 h-9 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">€</span>
                    <button
                      onClick={() => {
                        const arr = (editItem.supplements ?? []).filter((_, i) => i !== si);
                        setEditItem({ ...editItem, supplements: arr });
                      }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>

              <Button onClick={handleEditSave} className="w-full rounded-xl">{t('common.save')}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import modal */}
      <MenuImportModal
        open={showImport}
        onOpenChange={setShowImport}
        restaurant={restaurant}
        existingItems={items}
        onImportComplete={loadItems}
      />
    </div>
  );
};
