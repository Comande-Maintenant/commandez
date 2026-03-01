import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Plus, Pencil, Trash2, GripVertical, Loader2 } from "lucide-react";
import type { DbRestaurant } from "@/types/database";
import type { DbBase, DbViande, DbGarniture, DbSauce, DbAccompagnement, DbOrderConfig, DbCuisineStepTemplate } from "@/types/customization";
import {
  fetchAllBases, fetchAllViandes, fetchAllGarnitures, fetchAllSauces, fetchAllAccompagnements, fetchOrderConfig,
  fetchCuisineStepTemplates, fetchRestaurantCuisineType,
  insertBase, updateBase, deleteBase, batchUpdateBaseSortOrder,
  insertViande, updateViande, deleteViande, batchUpdateViandeSortOrder,
  insertGarniture, updateGarniture, deleteGarniture, batchUpdateGarnitureSortOrder,
  insertSauce, updateSauce, deleteSauce, batchUpdateSauceSortOrder,
  insertAccompagnement, updateAccompagnement, deleteAccompagnement, batchUpdateAccompagnementSortOrder,
  upsertOrderConfig,
} from "@/lib/customizationApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  restaurant: DbRestaurant;
}

type TabId = "bases" | "viandes" | "garnitures" | "sauces" | "accompagnements" | "config";

// Map data_source to TabId
const DATA_SOURCE_TO_TAB: Record<string, TabId> = {
  restaurant_bases: "bases",
  restaurant_viandes: "viandes",
  restaurant_garnitures: "garnitures",
  restaurant_sauces: "sauces",
  restaurant_accompagnements: "accompagnements",
};

// Map data_source to display label
const DATA_SOURCE_LABELS: Record<string, Record<string, string>> = {
  restaurant_bases: { default: "Bases" },
  restaurant_viandes: { default: "Viandes" },
  restaurant_garnitures: { default: "Garnitures" },
  restaurant_sauces: { default: "Sauces" },
  restaurant_accompagnements: { default: "Accomp." },
};

// Generic sortable row
function SortableRow({
  id,
  name,
  extra,
  enabled,
  onToggle,
  onEdit,
  onDelete,
}: {
  id: string;
  name: string;
  extra?: string;
  enabled: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 bg-card rounded-xl border border-border p-3 transition-opacity ${!enabled ? "opacity-50" : ""}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 shrink-0">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
        {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Switch checked={enabled} onCheckedChange={onToggle} className="scale-75" />
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

export const DashboardCustomization = ({ restaurant }: Props) => {
  const [activeTab, setActiveTab] = useState<TabId>("bases");
  const [loading, setLoading] = useState(true);

  // Data
  const [bases, setBases] = useState<DbBase[]>([]);
  const [viandes, setViandes] = useState<DbViande[]>([]);
  const [garnitures, setGarnitures] = useState<DbGarniture[]>([]);
  const [sauces, setSauces] = useState<DbSauce[]>([]);
  const [accompagnements, setAccompagnements] = useState<DbAccompagnement[]>([]);
  const [config, setConfig] = useState<DbOrderConfig | null>(null);
  const [stepTemplates, setStepTemplates] = useState<DbCuisineStepTemplate[]>([]);

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formSupplement, setFormSupplement] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(true);
  const [formForSandwich, setFormForSandwich] = useState(true);
  const [formForFrites, setFormForFrites] = useState(true);
  const [formHasSizes, setFormHasSizes] = useState(false);
  const [formPriceSmall, setFormPriceSmall] = useState("");
  const [formPriceMedium, setFormPriceMedium] = useState("");
  const [formPriceLarge, setFormPriceLarge] = useState("");
  const [formPriceDefault, setFormPriceDefault] = useState("");
  const [formHasSauceOption, setFormHasSauceOption] = useState(false);
  const [formMaxViandes, setFormMaxViandes] = useState("1");

  // Config form
  const [cfgFreeSandwich, setCfgFreeSandwich] = useState("3");
  const [cfgFreeFrites, setCfgFreeFrites] = useState("2");
  const [cfgExtraSauce, setCfgExtraSauce] = useState("0.50");
  const [cfgSuggestSauce, setCfgSuggestSauce] = useState(true);
  const [cfgBoissonUpsell, setCfgBoissonUpsell] = useState(true);
  const [cfgDessertUpsell, setCfgDessertUpsell] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    const cuisineType = await fetchRestaurantCuisineType(restaurant.id);
    const [b, v, g, s, a, c, templates] = await Promise.all([
      fetchAllBases(restaurant.id),
      fetchAllViandes(restaurant.id),
      fetchAllGarnitures(restaurant.id),
      fetchAllSauces(restaurant.id),
      fetchAllAccompagnements(restaurant.id),
      fetchOrderConfig(restaurant.id),
      fetchCuisineStepTemplates(cuisineType),
    ]);
    setBases(b);
    setViandes(v);
    setGarnitures(g);
    setSauces(s);
    setAccompagnements(a);
    setConfig(c);
    setStepTemplates(templates);
    if (c) {
      setCfgFreeSandwich(String(c.free_sauces_sandwich));
      setCfgFreeFrites(String(c.free_sauces_frites));
      setCfgExtraSauce(String(c.extra_sauce_price));
      setCfgSuggestSauce(c.suggest_sauce_from_sandwich);
      setCfgBoissonUpsell(c.enable_boisson_upsell);
      setCfgDessertUpsell(c.enable_dessert_upsell);
    }
    setLoading(false);
  }, [restaurant.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const resetForm = () => {
    setEditId(null);
    setFormName("");
    setFormPrice("");
    setFormSupplement("");
    setFormIsDefault(true);
    setFormForSandwich(true);
    setFormForFrites(true);
    setFormHasSizes(false);
    setFormPriceSmall("");
    setFormPriceMedium("");
    setFormPriceLarge("");
    setFormPriceDefault("");
    setFormHasSauceOption(false);
    setFormMaxViandes("1");
  };

  const openAdd = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (id: string) => {
    setEditId(id);
    if (activeTab === "bases") {
      const item = bases.find((b) => b.id === id);
      if (item) { setFormName(item.name); setFormPrice(String(item.price)); setFormMaxViandes(String(item.max_viandes)); }
    } else if (activeTab === "viandes") {
      const item = viandes.find((v) => v.id === id);
      if (item) { setFormName(item.name); setFormSupplement(String(item.supplement)); }
    } else if (activeTab === "garnitures") {
      const item = garnitures.find((g) => g.id === id);
      if (item) { setFormName(item.name); setFormIsDefault(item.is_default); }
    } else if (activeTab === "sauces") {
      const item = sauces.find((s) => s.id === id);
      if (item) { setFormName(item.name); setFormForSandwich(item.is_for_sandwich); setFormForFrites(item.is_for_frites); }
    } else if (activeTab === "accompagnements") {
      const item = accompagnements.find((a) => a.id === id);
      if (item) {
        setFormName(item.name);
        setFormHasSizes(item.has_sizes);
        setFormPriceSmall(String(item.price_small ?? ""));
        setFormPriceMedium(String(item.price_medium ?? ""));
        setFormPriceLarge(String(item.price_large ?? ""));
        setFormPriceDefault(String(item.price_default ?? ""));
        setFormHasSauceOption(item.has_sauce_option);
      }
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    try {
      if (activeTab === "bases") {
        const data = { name: formName.trim(), price: parseFloat(formPrice) || 0, max_viandes: parseInt(formMaxViandes) || 1 };
        if (editId) await updateBase(editId, data);
        else await insertBase({ ...data, restaurant_id: restaurant.id });
        setBases(await fetchAllBases(restaurant.id));
      } else if (activeTab === "viandes") {
        const data = { name: formName.trim(), supplement: parseFloat(formSupplement) || 0 };
        if (editId) await updateViande(editId, data);
        else await insertViande({ ...data, restaurant_id: restaurant.id });
        setViandes(await fetchAllViandes(restaurant.id));
      } else if (activeTab === "garnitures") {
        const data = { name: formName.trim(), is_default: formIsDefault };
        if (editId) await updateGarniture(editId, data);
        else await insertGarniture({ ...data, restaurant_id: restaurant.id });
        setGarnitures(await fetchAllGarnitures(restaurant.id));
      } else if (activeTab === "sauces") {
        const data = { name: formName.trim(), is_for_sandwich: formForSandwich, is_for_frites: formForFrites };
        if (editId) await updateSauce(editId, data);
        else await insertSauce({ ...data, restaurant_id: restaurant.id });
        setSauces(await fetchAllSauces(restaurant.id));
      } else if (activeTab === "accompagnements") {
        const data = {
          name: formName.trim(),
          has_sizes: formHasSizes,
          price_small: formHasSizes ? parseFloat(formPriceSmall) || null : null,
          price_medium: formHasSizes ? parseFloat(formPriceMedium) || null : null,
          price_large: formHasSizes ? parseFloat(formPriceLarge) || null : null,
          price_default: !formHasSizes ? parseFloat(formPriceDefault) || null : null,
          has_sauce_option: formHasSauceOption,
        };
        if (editId) await updateAccompagnement(editId, data);
        else await insertAccompagnement({ ...data, restaurant_id: restaurant.id });
        setAccompagnements(await fetchAllAccompagnements(restaurant.id));
      }
      setShowDialog(false);
      resetForm();
      toast.success(editId ? "Modifie" : "Ajoute");
    } catch {
      toast.error("Erreur");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ?")) return;
    try {
      if (activeTab === "bases") { await deleteBase(id); setBases(await fetchAllBases(restaurant.id)); }
      else if (activeTab === "viandes") { await deleteViande(id); setViandes(await fetchAllViandes(restaurant.id)); }
      else if (activeTab === "garnitures") { await deleteGarniture(id); setGarnitures(await fetchAllGarnitures(restaurant.id)); }
      else if (activeTab === "sauces") { await deleteSauce(id); setSauces(await fetchAllSauces(restaurant.id)); }
      else if (activeTab === "accompagnements") { await deleteAccompagnement(id); setAccompagnements(await fetchAllAccompagnements(restaurant.id)); }
      toast.success("Supprime");
    } catch {
      toast.error("Erreur");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      if (activeTab === "bases") {
        const item = bases.find((b) => b.id === id);
        if (item) { await updateBase(id, { enabled: !item.enabled }); setBases(await fetchAllBases(restaurant.id)); }
      } else if (activeTab === "viandes") {
        const item = viandes.find((v) => v.id === id);
        if (item) { await updateViande(id, { enabled: !item.enabled }); setViandes(await fetchAllViandes(restaurant.id)); }
      } else if (activeTab === "garnitures") {
        const item = garnitures.find((g) => g.id === id);
        if (item) { await updateGarniture(id, { enabled: !item.enabled }); setGarnitures(await fetchAllGarnitures(restaurant.id)); }
      } else if (activeTab === "sauces") {
        const item = sauces.find((s) => s.id === id);
        if (item) { await updateSauce(id, { enabled: !item.enabled }); setSauces(await fetchAllSauces(restaurant.id)); }
      } else if (activeTab === "accompagnements") {
        const item = accompagnements.find((a) => a.id === id);
        if (item) { await updateAccompagnement(id, { enabled: !item.enabled }); setAccompagnements(await fetchAllAccompagnements(restaurant.id)); }
      }
    } catch {
      toast.error("Erreur");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (activeTab === "bases") {
      const oldIndex = bases.findIndex((b) => b.id === active.id);
      const newIndex = bases.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(bases, oldIndex, newIndex);
      setBases(reordered);
      await batchUpdateBaseSortOrder(reordered.map((b, i) => ({ id: b.id, sort_order: i })));
    } else if (activeTab === "viandes") {
      const oldIndex = viandes.findIndex((v) => v.id === active.id);
      const newIndex = viandes.findIndex((v) => v.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(viandes, oldIndex, newIndex);
      setViandes(reordered);
      await batchUpdateViandeSortOrder(reordered.map((v, i) => ({ id: v.id, sort_order: i })));
    } else if (activeTab === "garnitures") {
      const oldIndex = garnitures.findIndex((g) => g.id === active.id);
      const newIndex = garnitures.findIndex((g) => g.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(garnitures, oldIndex, newIndex);
      setGarnitures(reordered);
      await batchUpdateGarnitureSortOrder(reordered.map((g, i) => ({ id: g.id, sort_order: i })));
    } else if (activeTab === "sauces") {
      const oldIndex = sauces.findIndex((s) => s.id === active.id);
      const newIndex = sauces.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(sauces, oldIndex, newIndex);
      setSauces(reordered);
      await batchUpdateSauceSortOrder(reordered.map((s, i) => ({ id: s.id, sort_order: i })));
    } else if (activeTab === "accompagnements") {
      const oldIndex = accompagnements.findIndex((a) => a.id === active.id);
      const newIndex = accompagnements.findIndex((a) => a.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(accompagnements, oldIndex, newIndex);
      setAccompagnements(reordered);
      await batchUpdateAccompagnementSortOrder(reordered.map((a, i) => ({ id: a.id, sort_order: i })));
    }
  };

  const handleSaveConfig = async () => {
    try {
      await upsertOrderConfig(restaurant.id, {
        free_sauces_sandwich: parseInt(cfgFreeSandwich) || 3,
        free_sauces_frites: parseInt(cfgFreeFrites) || 2,
        extra_sauce_price: parseFloat(cfgExtraSauce) || 0.50,
        suggest_sauce_from_sandwich: cfgSuggestSauce,
        enable_boisson_upsell: cfgBoissonUpsell,
        enable_dessert_upsell: cfgDessertUpsell,
      });
      toast.success("Configuration enregistree");
    } catch {
      toast.error("Erreur");
    }
  };

  // Build tabs dynamically from cuisine step templates
  const tabs: { id: TabId; label: string; count: number }[] = useMemo(() => {
    const countMap: Record<TabId, number> = {
      bases: bases.length,
      viandes: viandes.length,
      garnitures: garnitures.length,
      sauces: sauces.length,
      accompagnements: accompagnements.length,
      config: 0,
    };

    if (stepTemplates.length === 0) {
      // Fallback: show all tabs (backward compat for restaurants without templates)
      return [
        { id: "bases" as TabId, label: "Bases", count: bases.length },
        { id: "viandes" as TabId, label: "Viandes", count: viandes.length },
        { id: "garnitures" as TabId, label: "Garnitures", count: garnitures.length },
        { id: "sauces" as TabId, label: "Sauces", count: sauces.length },
        { id: "accompagnements" as TabId, label: "Accomp.", count: accompagnements.length },
        { id: "config" as TabId, label: "Config", count: 0 },
      ];
    }

    // Deduplicate data_sources from templates, keep order
    const seen = new Set<string>();
    const dynamicTabs: { id: TabId; label: string; count: number }[] = [];
    for (const tmpl of stepTemplates) {
      const tabId = DATA_SOURCE_TO_TAB[tmpl.data_source];
      if (!tabId || seen.has(tabId)) continue;
      seen.add(tabId);
      const label = DATA_SOURCE_LABELS[tmpl.data_source]?.default ?? tabId;
      dynamicTabs.push({ id: tabId, label, count: countMap[tabId] ?? 0 });
    }
    // Always add config tab
    dynamicTabs.push({ id: "config", label: "Config", count: 0 });
    return dynamicTabs;
  }, [stepTemplates, bases.length, viandes.length, garnitures.length, sauces.length, accompagnements.length]);

  const currentItems = activeTab === "bases" ? bases
    : activeTab === "viandes" ? viandes
    : activeTab === "garnitures" ? garnitures
    : activeTab === "sauces" ? sauces
    : activeTab === "accompagnements" ? accompagnements
    : [];

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">Personnalisation commande</h2>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id ? "bg-foreground text-background" : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
          >
            {tab.label}
            {tab.count > 0 && <span className="ml-1 text-xs opacity-60">({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* Config tab */}
      {activeTab === "config" && (
        <div className="space-y-4 max-w-md">
          <div>
            <label className="text-sm font-medium text-foreground">Sauces gratuites sandwich</label>
            <Input type="number" value={cfgFreeSandwich} onChange={(e) => setCfgFreeSandwich(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Sauces gratuites frites</label>
            <Input type="number" value={cfgFreeFrites} onChange={(e) => setCfgFreeFrites(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Prix sauce supplementaire (€)</label>
            <Input type="number" step="0.10" value={cfgExtraSauce} onChange={(e) => setCfgExtraSauce(e.target.value)} className="mt-1" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Suggerer sauce sandwich pour frites</span>
            <Switch checked={cfgSuggestSauce} onCheckedChange={setCfgSuggestSauce} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Upsell boisson</span>
            <Switch checked={cfgBoissonUpsell} onCheckedChange={setCfgBoissonUpsell} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Upsell dessert</span>
            <Switch checked={cfgDessertUpsell} onCheckedChange={setCfgDessertUpsell} />
          </div>
          <Button onClick={handleSaveConfig} className="w-full rounded-xl">Enregistrer</Button>
        </div>
      )}

      {/* List tabs */}
      {activeTab !== "config" && (
        <>
          <Button size="sm" className="rounded-xl gap-1 mb-3" onClick={openAdd}>
            <Plus className="h-4 w-4" />Ajouter
          </Button>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={currentItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {currentItems.map((item) => {
                  let extra = "";
                  if (activeTab === "bases") {
                    const b = item as DbBase;
                    extra = `${Number(b.price).toFixed(2)} € - ${b.max_viandes} viande(s) max`;
                  } else if (activeTab === "viandes") {
                    const v = item as DbViande;
                    extra = Number(v.supplement) > 0 ? `+${Number(v.supplement).toFixed(2)} €` : "Inclus";
                  } else if (activeTab === "garnitures") {
                    const g = item as DbGarniture;
                    extra = g.is_default ? "Par defaut" : "Optionnel";
                  } else if (activeTab === "sauces") {
                    const s = item as DbSauce;
                    const parts = [];
                    if (s.is_for_sandwich) parts.push("Sandwich");
                    if (s.is_for_frites) parts.push("Frites");
                    extra = parts.join(" + ");
                  } else if (activeTab === "accompagnements") {
                    const a = item as DbAccompagnement;
                    extra = a.has_sizes
                      ? `${Number(a.price_small ?? 0).toFixed(2)} - ${Number(a.price_large ?? 0).toFixed(2)} €`
                      : `${Number(a.price_default ?? 0).toFixed(2)} €`;
                  }

                  return (
                    <SortableRow
                      key={item.id}
                      id={item.id}
                      name={item.name}
                      extra={extra}
                      enabled={item.enabled}
                      onToggle={() => handleToggle(item.id)}
                      onEdit={() => openEdit(item.id)}
                      onDelete={() => handleDelete(item.id)}
                    />
                  );
                })}
                {currentItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucun element. Cliquez "Ajouter" pour commencer.</p>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier" : "Ajouter"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Nom" value={formName} onChange={(e) => setFormName(e.target.value)} />

            {activeTab === "bases" && (
              <>
                <Input type="number" step="0.50" placeholder="Prix (€)" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
                <Input type="number" placeholder="Max viandes" value={formMaxViandes} onChange={(e) => setFormMaxViandes(e.target.value)} />
              </>
            )}

            {activeTab === "viandes" && (
              <Input type="number" step="0.50" placeholder="Supplement (€, 0 si inclus)" value={formSupplement} onChange={(e) => setFormSupplement(e.target.value)} />
            )}

            {activeTab === "garnitures" && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Inclus par defaut</span>
                <Switch checked={formIsDefault} onCheckedChange={setFormIsDefault} />
              </div>
            )}

            {activeTab === "sauces" && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Pour sandwich</span>
                  <Switch checked={formForSandwich} onCheckedChange={setFormForSandwich} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Pour frites</span>
                  <Switch checked={formForFrites} onCheckedChange={setFormForFrites} />
                </div>
              </>
            )}

            {activeTab === "accompagnements" && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Tailles (petit/moyen/grand)</span>
                  <Switch checked={formHasSizes} onCheckedChange={setFormHasSizes} />
                </div>
                {formHasSizes ? (
                  <div className="grid grid-cols-3 gap-2">
                    <Input type="number" step="0.50" placeholder="Petit (€)" value={formPriceSmall} onChange={(e) => setFormPriceSmall(e.target.value)} />
                    <Input type="number" step="0.50" placeholder="Moyen (€)" value={formPriceMedium} onChange={(e) => setFormPriceMedium(e.target.value)} />
                    <Input type="number" step="0.50" placeholder="Grand (€)" value={formPriceLarge} onChange={(e) => setFormPriceLarge(e.target.value)} />
                  </div>
                ) : (
                  <Input type="number" step="0.50" placeholder="Prix (€)" value={formPriceDefault} onChange={(e) => setFormPriceDefault(e.target.value)} />
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Option sauce</span>
                  <Switch checked={formHasSauceOption} onCheckedChange={setFormHasSauceOption} />
                </div>
              </>
            )}

            <Button onClick={handleSave} className="w-full rounded-xl">
              {editId ? "Enregistrer" : "Ajouter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
