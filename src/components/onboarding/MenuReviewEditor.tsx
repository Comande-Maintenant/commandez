import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { AnalyzedCategory, AnalyzedItem } from '@/types/onboarding';

interface MenuReviewEditorProps {
  menu: AnalyzedCategory[];
  onConfirm: (categories: AnalyzedCategory[]) => void;
  onBack: () => void;
}

export function MenuReviewEditor({ menu, onConfirm, onBack }: MenuReviewEditorProps) {
  const [categories, setCategories] = useState<AnalyzedCategory[]>(
    JSON.parse(JSON.stringify(menu))
  );
  const [expandedCat, setExpandedCat] = useState<number | null>(0);

  const updateCategoryName = (catIdx: number, name: string) => {
    setCategories((prev) => {
      const next = [...prev];
      next[catIdx] = { ...next[catIdx], name };
      return next;
    });
  };

  const updateItem = (catIdx: number, itemIdx: number, field: keyof AnalyzedItem, value: any) => {
    setCategories((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      (next[catIdx].items[itemIdx] as any)[field] = value;
      return next;
    });
  };

  const deleteItem = (catIdx: number, itemIdx: number) => {
    setCategories((prev) => {
      const next = [...prev];
      next[catIdx] = {
        ...next[catIdx],
        items: next[catIdx].items.filter((_, i) => i !== itemIdx),
      };
      return next;
    });
  };

  const addItem = (catIdx: number) => {
    setCategories((prev) => {
      const next = [...prev];
      next[catIdx] = {
        ...next[catIdx],
        items: [
          ...next[catIdx].items,
          { name: '', price: 0, description: '', variants: [], supplements: [], tags: [] },
        ],
      };
      return next;
    });
  };

  const deleteCategory = (catIdx: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== catIdx));
  };

  const addCategory = () => {
    setCategories((prev) => [
      ...prev,
      { name: 'Nouvelle categorie', items: [] },
    ]);
    setExpandedCat(categories.length);
  };

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {categories.length} categories, {totalItems} articles detectes
        </p>
        <Button variant="outline" size="sm" onClick={addCategory}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Categorie
        </Button>
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {categories.map((cat, catIdx) => (
          <div key={catIdx} className="border border-border rounded-lg overflow-hidden">
            <div
              className="flex items-center gap-2 p-3 bg-muted/50 cursor-pointer"
              onClick={() => setExpandedCat(expandedCat === catIdx ? null : catIdx)}
            >
              {expandedCat === catIdx ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <Input
                value={cat.name}
                onChange={(e) => updateCategoryName(catIdx, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="font-medium h-8 bg-transparent border-0 p-0 focus-visible:ring-0"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {cat.items.length} articles
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCategory(catIdx);
                }}
                className="p-1 text-destructive hover:bg-destructive/10 rounded"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {expandedCat === catIdx && (
              <div className="p-3 space-y-3">
                {cat.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className="grid grid-cols-[1fr_80px_32px] gap-2 items-start"
                  >
                    <div className="space-y-1">
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(catIdx, itemIdx, 'name', e.target.value)}
                        placeholder="Nom"
                        className="h-8 text-sm"
                      />
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(catIdx, itemIdx, 'description', e.target.value)}
                        placeholder="Description (optionnel)"
                        className="h-7 text-xs"
                      />
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItem(catIdx, itemIdx, 'price', parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm text-right"
                    />
                    <button
                      onClick={() => deleteItem(catIdx, itemIdx)}
                      className="p-1.5 text-destructive hover:bg-destructive/10 rounded mt-0.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addItem(catIdx)}
                  className="w-full text-muted-foreground"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Ajouter un article
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Retour
        </Button>
        <Button
          onClick={() => onConfirm(categories)}
          className="flex-1"
          disabled={totalItems === 0}
        >
          Valider ma carte
        </Button>
      </div>
    </div>
  );
}
