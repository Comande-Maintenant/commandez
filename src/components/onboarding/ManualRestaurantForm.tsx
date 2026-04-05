import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CUISINE_TYPE_OPTIONS } from '@/lib/cuisineTypes';
import { useLanguage } from '@/context/LanguageContext';

const schema = z.object({
  name: z.string().min(2),
  address: z.string().min(3),
  city: z.string().min(2),
  phone: z.string().optional(),
  cuisine: z.string().min(2),
  cuisine_type: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

interface ManualRestaurantFormProps {
  onSubmit: (data: FormData) => void;
  initialData?: Partial<FormData>;
}

export function ManualRestaurantForm({ onSubmit, initialData }: ManualRestaurantFormProps) {
  const { t } = useLanguage();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ...initialData, cuisine_type: initialData?.cuisine_type || 'generic' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">{t('onboarding.place.name_label')}</Label>
        <Input id="name" {...register('name')} placeholder={t('onboarding.place.name_placeholder')} />
        {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="address">{t('onboarding.place.address_label')}</Label>
        <Input id="address" {...register('address')} placeholder={t('onboarding.place.address_placeholder')} />
        {errors.address && <p className="text-sm text-destructive mt-1">{errors.address.message}</p>}
      </div>

      <div>
        <Label htmlFor="city">{t('onboarding.place.city_label')}</Label>
        <Input id="city" {...register('city')} placeholder={t('onboarding.place.city_placeholder')} />
        {errors.city && <p className="text-sm text-destructive mt-1">{errors.city.message}</p>}
      </div>

      <div>
        <Label htmlFor="phone">{t('onboarding.place.phone_label')}</Label>
        <Input id="phone" {...register('phone')} placeholder={t('onboarding.place.manual_phone_placeholder')} />
      </div>

      <div>
        <Label htmlFor="cuisine">{t('onboarding.place.cuisine_label')}</Label>
        <Input id="cuisine" {...register('cuisine')} placeholder={t('onboarding.place.cuisine_placeholder')} />
        {errors.cuisine && <p className="text-sm text-destructive mt-1">{errors.cuisine.message}</p>}
      </div>

      <div>
        <Label>{t('onboarding.place.type_label')}</Label>
        <Controller
          control={control}
          name="cuisine_type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder={t('onboarding.place.type_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {CUISINE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.cuisine_type && <p className="text-sm text-destructive mt-1">{errors.cuisine_type.message}</p>}
      </div>

      <Button type="submit" className="w-full">{t('common.continue')}</Button>
    </form>
  );
}
