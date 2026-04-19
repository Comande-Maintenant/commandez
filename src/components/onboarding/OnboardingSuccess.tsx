import { useState } from 'react';
import { Check, Copy, ChevronDown, ChevronUp, Loader2, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
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

interface PromoResult {
  valid: boolean;
  type?: string;
  value?: number;
  description?: string;
  error?: string;
}

export function OnboardingSuccess({ restaurantName, slug, email, restaurantId, plan }: OnboardingSuccessProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const publicUrl = `${window.location.origin}/${slug}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-promo', {
        body: { code: promoCode.trim(), restaurant_id: restaurantId },
      });
      if (error) throw error;
      setPromoResult(data as PromoResult);
      if (data?.valid) {
        toast.success(t('subscription.promo_applied'));
      } else {
        toast.error(data?.error || t('subscription.invalid_code'));
      }
    } catch {
      toast.error(t('subscription.validation_error'));
    } finally {
      setPromoLoading(false);
    }
  };

  const handleAddCard = async () => {
    setCheckoutLoading(true);
    try {
      const checkoutPlan = plan === 'none' ? 'monthly' : plan;

      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          plan: checkoutPlan,
          restaurant_id: restaurantId,
          restaurant_slug: slug,
          email,
          promo_code: promoResult?.valid ? promoCode.trim().toUpperCase() : undefined,
        },
      });

      if (error || data?.error) {
        toast.error(data?.error || t('subscription.redirect_error'));
        return;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        toast.error(t('subscription.redirect_error'));
      }
    } catch {
      toast.error(t('subscription.redirect_error'));
    } finally {
      setCheckoutLoading(false);
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
          {t('onboarding.success.trial_started')}
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

      <div className="pt-4 border-t border-border max-w-md mx-auto">
        <button
          onClick={() => setPromoOpen(!promoOpen)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
        >
          {t('onboarding.success.promo_question')}
          {promoOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {promoOpen && (
          <div className="mt-3 flex gap-2">
            <Input
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
                setPromoResult(null);
              }}
              placeholder="LANCEMENT"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleValidatePromo}
              disabled={promoLoading || !promoCode.trim()}
            >
              {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.apply')}
            </Button>
          </div>
        )}
        {promoResult?.valid && (
          <p className="text-sm text-green-600 mt-2">{promoResult.description}</p>
        )}
        {promoResult && !promoResult.valid && (
          <p className="text-sm text-destructive mt-2">{promoResult.error}</p>
        )}

        <button
          onClick={handleAddCard}
          disabled={checkoutLoading}
          className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors underline inline-flex items-center gap-1"
        >
          {checkoutLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {t('onboarding.success.add_card_now')}
        </button>
      </div>
    </div>
  );
}
