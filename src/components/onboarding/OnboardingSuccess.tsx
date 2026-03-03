import { useState, useEffect, useRef } from 'react';
import { Check, Copy, ChevronDown, ChevronUp, Loader2, Lock, CalendarOff, RefreshCw, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { buildCheckoutUrl } from '@/services/shopify-checkout';
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

type Phase = 'ready' | 'waiting' | 'confirmed';

export function OnboardingSuccess({ restaurantName, slug, email, restaurantId, plan }: OnboardingSuccessProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const publicUrl = `${window.location.origin}/${slug}`;

  // Poll subscription status when waiting
  useEffect(() => {
    if (phase !== 'waiting') return;

    const poll = async () => {
      try {
        const { data } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('restaurant_id', restaurantId)
          .single();
        if (data && data.status !== 'pending_payment') {
          setPhase('confirmed');
        }
      } catch {
        // ignore polling errors
      }
    };

    // Poll immediately then every 3s
    poll();
    pollRef.current = setInterval(poll, 3000);

    // Stop after 5 minutes
    const timeout = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
    }, 5 * 60 * 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearTimeout(timeout);
    };
  }, [phase, restaurantId]);

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

  const handleActivate = () => {
    try {
      const checkoutPlan = plan === 'none' ? 'monthly' : plan;
      const url = buildCheckoutUrl({
        plan: checkoutPlan as 'monthly' | 'annual',
        restaurantId,
        restaurantSlug: slug,
        email,
        promoCode: promoResult?.valid ? promoCode.trim().toUpperCase() : undefined,
      });
      // Open checkout in new tab, start polling in current tab
      window.open(url, '_blank');
      setPhase('waiting');
    } catch {
      toast.error(t('subscription.redirect_error'));
    }
  };

  // ---- Phase: confirmed ----
  if (phase === 'confirmed') {
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
      </div>
    );
  }

  // ---- Phase: waiting for webhook ----
  if (phase === 'waiting') {
    return (
      <div className="space-y-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mx-auto">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground">
            {t('onboarding.success.finalize')}
          </h2>
          <p className="text-muted-foreground mt-2">
            {t('onboarding.success.finalize_desc')}<br />
            {t('onboarding.success.auto_update')}
          </p>
        </div>

        <div className="bg-muted/50 rounded-xl p-4 max-w-md mx-auto text-sm text-muted-foreground space-y-2">
          <p>{t('onboarding.success.tab_not_opened')}</p>
          <Button variant="outline" size="sm" onClick={handleActivate}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            {t('onboarding.success.reopen_payment')}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('onboarding.success.no_charge_today')}
        </p>
      </div>
    );
  }

  // ---- Phase: ready (initial) ----
  return (
    <div className="space-y-6 text-center">
      {/* Checkmark */}
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
        <Check className="h-8 w-8 text-green-600" />
      </div>

      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          {t('onboarding.success.almost_ready', { name: restaurantName })}
        </h2>
        <p className="text-muted-foreground mt-2">
          {t('onboarding.success.activate_trial')}
        </p>
      </div>

      {/* Future URL (non-clickable, greyed) */}
      <div className="flex items-center gap-2 bg-muted/60 rounded-lg p-3 mx-auto max-w-md">
        <span className="text-sm font-mono truncate flex-1 text-muted-foreground">
          {publicUrl}
        </span>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
        </Button>
      </div>

      {/* Reassurance points */}
      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-green-600" />
          <span>{t('onboarding.success.trial_14_days')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-green-600" />
          <span>{t('onboarding.success.no_payment_today')}</span>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-green-600" />
          <span>{t('onboarding.success.cancel_anytime')}</span>
        </div>
      </div>

      {/* Promo code (collapsible) */}
      <div className="max-w-md mx-auto">
        <button
          onClick={() => setPromoOpen(!promoOpen)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
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
      </div>

      {/* CTA */}
      <Button
        onClick={handleActivate}
        className="w-full max-w-md mx-auto h-12 rounded-xl text-base"
      >
        {t('onboarding.success.activate_button')}
        <ExternalLink className="h-4 w-4 ml-2" />
      </Button>

      {/* Small print */}
      <p className="text-xs text-muted-foreground max-w-md mx-auto">
        {t('onboarding.success.fine_print')}
      </p>
    </div>
  );
}
