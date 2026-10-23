import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/context/LanguageContext';
import { catalogCategories, emptyCatalogRow, type CatalogRow } from '@/lib/commerce-catalog';
import type { AnalyzedCategory } from '@/types/onboarding';

export function CommerceCatalogEditor({ rows, onChange, onConfirm, onBack, onSkip }: {
  rows: CatalogRow[]; onChange: (rows: CatalogRow[]) => void; onConfirm: (categories: AnalyzedCategory[]) => void; onBack: () => void; onSkip: () => void;
}) {
  const { t } = useLanguage();
  const categories = catalogCategories(rows);
  const update = (id: string, field: keyof Omit<CatalogRow, 'id'>, value: string) => onChange(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  return <div className="space-y-4">
    <h2 className="text-xl font-bold">{t('commerce.setup_products')}</h2>
    <p className="text-sm text-muted-foreground">{t('commerce.setup_help')}</p>
    {rows.map((row, index) => <fieldset key={row.id} className="space-y-3 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-medium">{index + 1}</legend>
      <label className="block text-sm">{t('commerce.setup_product_name')}<Input value={row.name} maxLength={160} onChange={e => update(row.id, 'name', e.target.value)} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">{t('commerce.setup_price')}<Input value={row.price} inputMode="decimal" maxLength={10} onChange={e => update(row.id, 'price', e.target.value)} /></label>
        <label className="block text-sm">{t('commerce.setup_category')}<Input value={row.category} maxLength={80} onChange={e => update(row.id, 'category', e.target.value)} /></label>
      </div>
      <label className="block text-sm">{t('commerce.setup_description')}<Input value={row.description} maxLength={500} onChange={e => update(row.id, 'description', e.target.value)} /></label>
      <Button type="button" variant="ghost" className="h-auto min-h-11 whitespace-normal text-destructive" onClick={() => onChange(rows.filter(item => item.id !== row.id))}>{t('commerce.setup_remove')}</Button>
    </fieldset>)}
    <Button type="button" variant="outline" disabled={rows.length >= 500} className="h-auto min-h-11 w-full whitespace-normal" onClick={() => onChange([...rows, emptyCatalogRow(t('commerce.setup_products'))])}>{t('commerce.setup_add_product')}</Button>
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button type="button" variant="outline" className="h-auto min-h-12 flex-1 whitespace-normal" onClick={onBack}>{t('common.back')}</Button>
      <Button type="button" disabled={!categories} className="h-auto min-h-12 flex-1 whitespace-normal" onClick={() => { if (categories) onConfirm(categories); }}>{t('commerce.setup_confirm')}</Button>
    </div>
    <Button type="button" variant="ghost" className="h-auto min-h-11 w-full whitespace-normal" onClick={onSkip}>{t('commerce.setup_later')}</Button>
  </div>;
}
