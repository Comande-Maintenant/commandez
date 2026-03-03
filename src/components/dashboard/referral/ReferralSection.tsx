import { useState, useEffect, useCallback } from "react";
import { Gift, Copy, Check, Send, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getReferralStats, getReferrals, type Referral, type ReferralStats } from "@/services/referral";
import { BRANDING } from "@/config/branding";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  restaurantId: string;
}

export function ReferralSection({ restaurantId }: Props) {
  const { t } = useLanguage();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        getReferralStats(restaurantId),
        getReferrals(restaurantId),
      ]);
      setStats(s);
      setReferrals(r);
    } catch {
      // Ignore errors
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const referralLink = stats?.referralCode
    ? `${BRANDING.baseUrl}/inscription?ref=${stats.referralCode}`
    : "";

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success(t('common.toast.link_copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('common.toast.copy_error'));
    }
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      t('dashboard.referral.whatsapp_message', { url: referralLink })
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(t('dashboard.referral.email_subject'));
    const body = encodeURIComponent(
      t('dashboard.referral.email_body', { url: referralLink })
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="h-10 bg-muted rounded mb-3" />
        <div className="h-10 bg-muted rounded" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
          <Gift className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{t('dashboard.referral.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.referral.description')}
          </p>
        </div>
      </div>

      {/* Referral link */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 bg-muted rounded-xl px-4 py-2.5 text-sm font-mono text-foreground truncate">
          {referralLink}
        </div>
        <Button variant="outline" size="icon" onClick={handleCopy} className="flex-shrink-0">
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      {/* Share buttons */}
      <div className="flex gap-2 mb-6">
        <Button variant="outline" size="sm" onClick={handleWhatsApp} className="flex-1">
          <Send className="h-4 w-4 mr-1.5" />
          WhatsApp
        </Button>
        <Button variant="outline" size="sm" onClick={handleEmail} className="flex-1">
          <Mail className="h-4 w-4 mr-1.5" />
          Email
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 bg-muted rounded-xl">
          <div className="text-lg font-bold text-foreground">{stats.totalReferrals}</div>
          <div className="text-xs text-muted-foreground">{t('dashboard.referral.referrals')}</div>
        </div>
        <div className="text-center p-3 bg-muted rounded-xl">
          <div className="text-lg font-bold text-emerald-600">{stats.completedReferrals}</div>
          <div className="text-xs text-muted-foreground">{t('dashboard.referral.confirmed')}</div>
        </div>
        <div className="text-center p-3 bg-muted rounded-xl">
          <div className="text-lg font-bold text-emerald-600">+{stats.totalBonusWeeks} {t('dashboard.referral.weeks_unit')}</div>
          <div className="text-xs text-muted-foreground">{t('dashboard.referral.earned')}</div>
        </div>
      </div>

      {/* Referral history */}
      {referrals.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">{t('dashboard.referral.history')}</h4>
          <div className="space-y-2">
            {referrals.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                <span className="text-muted-foreground">
                  {r.referee_email || t('dashboard.referral.default_name')}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  r.status === "completed"
                    ? "bg-emerald-50 text-emerald-700"
                    : r.status === "pending"
                    ? "bg-yellow-50 text-yellow-700"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {r.status === "completed" ? t('dashboard.referral.status_confirmed') : r.status === "pending" ? t('dashboard.referral.status_pending') : t('dashboard.referral.status_expired')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
