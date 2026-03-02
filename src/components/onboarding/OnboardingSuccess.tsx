import { useState } from 'react';
import { Check, Copy, ChevronDown, ChevronUp, Loader2, Lock, CalendarOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { buildCheckoutUrl } from '@/services/shopify-checkout';
import { toast } from 'sonner';
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
  const [copied, setCopied] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

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
        toast.success('Code promo applique !');
      } else {
        toast.error(data?.error || 'Code invalide');
      }
    } catch {
      toast.error('Erreur lors de la validation');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleActivate = () => {
    setRedirecting(true);
    try {
      const checkoutPlan = plan === 'none' ? 'monthly' : plan;
      const url = buildCheckoutUrl({
        plan: checkoutPlan as 'monthly' | 'annual',
        restaurantId,
        restaurantSlug: slug,
        email,
        promoCode: promoResult?.valid ? promoCode.trim().toUpperCase() : undefined,
      });
      window.location.href = url;
    } catch {
      toast.error('Erreur lors de la redirection.');
      setRedirecting(false);
    }
  };

  return (
    <div className="space-y-6 text-center">
      {/* Checkmark */}
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
        <Check className="h-8 w-8 text-green-600" />
      </div>

      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          {restaurantName} est presque pret !
        </h2>
        <p className="text-muted-foreground mt-2">
          Activez votre essai gratuit de 14 jours pour mettre votre page en ligne.
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
          <span>14 jours d'essai gratuit</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-green-600" />
          <span>Aucun paiement aujourd'hui</span>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-green-600" />
          <span>Annulez a tout moment</span>
        </div>
      </div>

      {/* Promo code (collapsible) */}
      <div className="max-w-md mx-auto">
        <button
          onClick={() => setPromoOpen(!promoOpen)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
        >
          Vous avez un code promo ?
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
              {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Appliquer'}
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
        disabled={redirecting}
        className="w-full max-w-md mx-auto h-12 rounded-xl text-base"
      >
        {redirecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Redirection en cours...
          </>
        ) : (
          'Activer mon essai gratuit'
        )}
      </Button>

      {/* Small print */}
      <p className="text-xs text-muted-foreground max-w-md mx-auto">
        Vous allez etre redirige vers Shopify pour enregistrer votre CB. Vous ne serez debite que dans 14 jours.
      </p>
    </div>
  );
}
