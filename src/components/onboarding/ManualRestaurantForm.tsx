import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const schema = z.object({
  name: z.string().min(2, 'Nom requis'),
  address: z.string().min(3, 'Adresse requise'),
  city: z.string().min(2, 'Ville requise'),
  phone: z.string().optional(),
  cuisine: z.string().min(2, 'Type de cuisine requis'),
});

type FormData = z.infer<typeof schema>;

interface ManualRestaurantFormProps {
  onSubmit: (data: FormData) => void;
  initialData?: Partial<FormData>;
}

export function ManualRestaurantForm({ onSubmit, initialData }: ManualRestaurantFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Nom du restaurant</Label>
        <Input id="name" {...register('name')} placeholder="Ex: Chez Marco" />
        {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="address">Adresse</Label>
        <Input id="address" {...register('address')} placeholder="12 rue de la Paix" />
        {errors.address && <p className="text-sm text-destructive mt-1">{errors.address.message}</p>}
      </div>

      <div>
        <Label htmlFor="city">Ville</Label>
        <Input id="city" {...register('city')} placeholder="Paris" />
        {errors.city && <p className="text-sm text-destructive mt-1">{errors.city.message}</p>}
      </div>

      <div>
        <Label htmlFor="phone">Telephone (optionnel)</Label>
        <Input id="phone" {...register('phone')} placeholder="01 23 45 67 89" />
      </div>

      <div>
        <Label htmlFor="cuisine">Type de cuisine</Label>
        <Input id="cuisine" {...register('cuisine')} placeholder="Pizzeria, Kebab, Sushi..." />
        {errors.cuisine && <p className="text-sm text-destructive mt-1">{errors.cuisine.message}</p>}
      </div>

      <Button type="submit" className="w-full">Continuer</Button>
    </form>
  );
}
