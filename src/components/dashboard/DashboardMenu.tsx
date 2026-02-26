import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Eye, EyeOff, X, GripVertical } from "lucide-react";
import { restaurants } from "@/data/mockData";
import type { MenuItem } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const restaurant = restaurants[0]; // Mock: first restaurant

export const DashboardMenu = () => {
  const [items, setItems] = useState<(MenuItem & { enabled: boolean })[]>(
    restaurant.menu.map((m) => ({ ...m, enabled: true }))
  );
  const [activeCategory, setActiveCategory] = useState(restaurant.categories[0]);
  const [editItem, setEditItem] = useState<(MenuItem & { enabled: boolean }) | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", description: "", price: "", category: activeCategory });

  const filtered = items.filter((i) => i.category === activeCategory);

  const toggleItem = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)));
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAddItem = () => {
    if (!newItem.name || !newItem.price) return;
    const item: MenuItem & { enabled: boolean } = {
      id: `new-${Date.now()}`,
      name: newItem.name,
      description: newItem.description,
      price: parseFloat(newItem.price),
      image: "",
      category: newItem.category,
      supplements: [],
      sauces: [],
      enabled: true,
    };
    setItems((prev) => [...prev, item]);
    setNewItem({ name: "", description: "", price: "", category: activeCategory });
    setShowAdd(false);
  };

  const handleEditSave = () => {
    if (!editItem) return;
    setItems((prev) => prev.map((i) => (i.id === editItem.id ? editItem : i)));
    setEditItem(null);
  };

  return (
    <div>
      {/* Category tabs + Add button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {restaurant.categories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setNewItem((n) => ({ ...n, category: cat })); }}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? "bg-foreground text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <Button size="sm" className="rounded-xl gap-1 shrink-0 ml-2" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Ajouter</span>
        </Button>
      </div>

      {/* Menu items list */}
      <div className="space-y-2">
        {filtered.map((item) => (
          <motion.div
            key={item.id}
            layout
            className={`flex items-center gap-3 bg-card rounded-2xl border border-border p-3 transition-opacity ${
              !item.enabled ? "opacity-50" : ""
            }`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />

            {item.image && (
              <img src={item.image} alt={item.name} className="h-12 w-12 rounded-xl object-cover shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
              {item.description && (
                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
              )}
            </div>

            <span className="text-sm font-bold text-foreground shrink-0">{item.price.toFixed(2)} €</span>

            <div className="flex items-center gap-1.5 shrink-0">
              <Switch
                checked={item.enabled}
                onCheckedChange={() => toggleItem(item.id)}
                className="scale-75"
              />
              <button
                onClick={() => setEditItem(item)}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => deleteItem(item.id)}
                className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un produit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder="Nom du produit"
              value={newItem.name}
              onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))}
            />
            <Input
              placeholder="Description (optionnel)"
              value={newItem.description}
              onChange={(e) => setNewItem((n) => ({ ...n, description: e.target.value }))}
            />
            <Input
              type="number"
              step="0.50"
              placeholder="Prix (€)"
              value={newItem.price}
              onChange={(e) => setNewItem((n) => ({ ...n, price: e.target.value }))}
            />
            <Button onClick={handleAddItem} className="w-full rounded-xl">
              Ajouter au menu
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le produit</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-3 mt-2">
              <Input
                value={editItem.name}
                onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
              />
              <Input
                value={editItem.description}
                onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}
              />
              <Input
                type="number"
                step="0.50"
                value={editItem.price}
                onChange={(e) => setEditItem({ ...editItem, price: parseFloat(e.target.value) || 0 })}
              />
              <Button onClick={handleEditSave} className="w-full rounded-xl">
                Enregistrer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
