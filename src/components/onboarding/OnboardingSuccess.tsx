import { isNative, publicAppUrl, shareRestaurant } from '@/lib/native';
import { useState } from 'react';
import { Check, Copy, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import type { SubscriptionPlan } from '@/types/onboarding';

interface OnboardingSuccessProps {
  restaurantName: string;
  slug: string;
  email: string;
  restaurantId: string;
  plan: SubscriptionPlan;
}

export function OnboardingSuccess({ restaurantName, slug }: OnboardingSuccessProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const publicUrl = `${publicAppUrl}/${encodeURIComponent(slug)}`;

  const handleCopy = async () => {
    try {
      await shareRestaurant(slug, restaurantName);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('common.toast.copy_error'));
    }
  };

  return (
    <div className="space-y-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
        <Check className="h-8 w-8 text-green-600" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground">
          {t('onboarding.success.online', { name: restaurantName })}
        </h2>
        <p className="text-muted-foreground mt-2">
          {t(isNative() ? 'native.free.title' : 'commerce.online_desc')}
        </p>
      </div>

      <div className="flex items-center gap-2 bg-muted rounded-lg p-3 mx-auto max-w-md">
        <span className="text-sm font-mono truncate flex-1 text-foreground">
          {publicUrl}
        </span>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
        <a href={publicUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </a>
      </div>

      <Link to={`/admin/${slug}`}>
        <Button className="mt-2">
          {t('onboarding.success.go_dashboard')}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </Link>

      {!isNative() && <p className="text-sm text-muted-foreground">{t('commerce.free_title')}</p>}
    </div>
  );
}
