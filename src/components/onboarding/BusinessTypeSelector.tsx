import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { businessTypes, businessTypeLabel, type BusinessType } from '@/lib/business-type';

export function BusinessTypeSelector({ value, onChange }: { value: BusinessType; onChange: (value: BusinessType) => void }) {
  const { t } = useLanguage();
  return <fieldset className="space-y-2">
    <legend className="text-sm font-medium">{t('commerce.setup_activity')}</legend>
    <div className="grid gap-2 sm:grid-cols-3">
      {businessTypes.map(type => <Button key={type} type="button" variant={type === value ? 'default' : 'outline'} aria-pressed={type === value}
        className="h-auto min-h-12 whitespace-normal px-3 py-3" onClick={() => onChange(type)}>{t(businessTypeLabel[type])}</Button>)}
    </div>
  </fieldset>;
}
