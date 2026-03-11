import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/context/LanguageContext";
import {
  Power,
  CreditCard,
  Clock,
  Bell,
  User,
  LogOut,
  Trash2,
  Loader2,
  AlertTriangle,
  ShoppingBag,
  Volume2,
  VolumeX,
  Play,
  Crown,
  Tag,
  ExternalLink,
} from "lucide-react";
import { updateRestaurant } from "@/lib/api";
import { ReferralSection } from "./referral/ReferralSection";
import type { DbRestaurant, DbSubscription } from "@/types/database";
import { Link } from "react-router-dom";
import { PLAN_PRICES } from "@/services/shopify-checkout";
import { ScheduleEditor, type ScheduleDay } from "./ScheduleEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import type { SoundControls } from "@/hooks/useNotificationSound";

interface Props {
  restaurant: DbRestaurant;
  sound?: SoundControls;
  isDemo?: boolean;
}

const orderedDays = [1, 2, 3, 4, 5, 6, 0];

export const DashboardParametres = ({ restaurant, sound, isDemo }: Props) => {
  const { t, language } = useLanguage();

  const LOCALE_MAP: Record<string, string> = { fr: "fr-FR", en: "en-US", es: "es-ES", de: "de-DE", it: "it-IT", pt: "pt-PT", nl: "nl-NL", ar: "ar-SA", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", ru: "ru-RU", tr: "tr-TR", vi: "vi-VN" };
  const locale = LOCALE_MAP[language] || "fr-FR";

  const availabilityModes = useMemo(() => [
    { id: "manual", label: t('dashboard.settings.manual'), desc: t('dashboard.settings.manual_desc') },
    { id: "auto", label: t('dashboard.settings.automatic'), desc: t('dashboard.settings.automatic_desc') },
    { id: "always", label: t('dashboard.settings.always_open'), desc: t('dashboard.settings.always_open_desc') },
  ], [t]);

  const orderModeOptions = useMemo(() => [
    { id: "on_site", label: t('dashboard.settings.dine_in') },
    { id: "pickup", label: t('dashboard.settings.takeaway') },
  ], [t]);

  const paymentOptions = useMemo(() => [
    { id: "cash", label: t('dashboard.settings.cash') },
    { id: "card", label: t('dashboard.settings.card') },
    { id: "ticket_restaurant", label: t('dashboard.settings.meal_voucher') },
    { id: "apple_google_pay", label: t('dashboard.settings.apple_google_pay') },
  ], [t]);

  const [saving, setSaving] = useState(false);
  const [isAccepting, setIsAccepting] = useState(restaurant.is_accepting_orders);
  const [availabilityMode, setAvailabilityMode] = useState(restaurant.availability_mode || "manual");
  const [orderMode, setOrderMode] = useState(restaurant.order_mode || "pickup");
  const [minimumOrder, setMinimumOrder] = useState(String(restaurant.minimum_order ?? 0));
  const [estimatedTime, setEstimatedTime] = useState(restaurant.estimated_time || "20-30 min");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(restaurant.payment_methods ?? []);
  const [prepTime, setPrepTime] = useState(restaurant.prep_time_config ?? { default_minutes: 20, per_item_minutes: 3, max_minutes: 90 });
  const [dineInCapacity, setDineInCapacity] = useState(String(restaurant.dine_in_capacity ?? ""));
  const [phoneNumber, setPhoneNumber] = useState(restaurant.restaurant_phone || "");
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  // Load schedule from restaurant.schedule JSON (supports multi-slots)
  useEffect(() => {
    const saved: ScheduleDay[] | null = restaurant.schedule;
    if (saved && Array.isArray(saved) && saved.length > 0) {
      setSchedule(saved);
    } else {
      setSchedule(
        orderedDays.map((d) => ({
          day: d,
          enabled: d !== 0,
          slots: [{ open: "11:00", close: "23:00" }],
        }))
      );
    }
    setLoadingSchedule(false);
  }, [restaurant.id, restaurant.schedule]);

  const togglePayment = (id: string) => {
    setPaymentMethods((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const selectedOrderModes = orderMode.split("_").filter(Boolean);
  const toggleOrderMode = (id: string) => {
    const modes = new Set(selectedOrderModes);
    if (modes.has(id)) {
      modes.delete(id);
    } else {
      modes.add(id);
    }
    setOrderMode(Array.from(modes).join("_") || "pickup");
  };

  const handleToggleAccepting = async (val: boolean) => {
    setIsAccepting(val);
    if (isDemo) return;
    await updateRestaurant(restaurant.id, { is_accepting_orders: val } as any);
  };

  const handleSave = async () => {
    setSaving(true);
    if (isDemo) {
      toast.success(t('dashboard.settings.saved'));
      setSaving(false);
      return;
    }
    try {
      // Save restaurant settings
      await updateRestaurant(restaurant.id, {
        availability_mode: availabilityMode,
        order_mode: orderMode,
        minimum_order: parseFloat(minimumOrder) || 0,
        estimated_time: estimatedTime,
        payment_methods: paymentMethods,
        prep_time_config: prepTime,
        restaurant_phone: phoneNumber,
        dine_in_capacity: dineInCapacity ? parseInt(dineInCapacity) || null : null,
      } as any);

      // Save schedule as JSON (supports multi-slots per day)
      await updateRestaurant(restaurant.id, { schedule } as any);

      toast.success(t('dashboard.settings.saved'));
    } catch (e) {
      toast.error(t('common.toast.save_error'));
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    if (isDemo) { window.location.href = "/"; return; }
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const [subscription, setSubscription] = useState<DbSubscription | null>(null);

  // Load subscription info
  useEffect(() => {
    supabase
      .from("subscriptions")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setSubscription(data as unknown as DbSubscription);
      });
  }, [restaurant.id]);

  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    if (isDemo) {
      toast.success(t('dashboard.settings.promo_applied'));
      setPromoInput("");
      return;
    }
    setPromoLoading(true);
    try {
      const { data } = await supabase.functions.invoke("validate-promo", {
        body: { code: promoInput.trim(), restaurant_id: restaurant.id },
      });
      if (data?.valid) {
        toast.success(data.description || t('dashboard.settings.promo_applied'));
        setPromoInput("");
      } else {
        toast.error(data?.error || t('dashboard.settings.invalid_code'));
      }
    } catch {
      toast.error(t('subscription.validation_error'));
    } finally {
      setPromoLoading(false);
    }
  };

  const [deactivateConfirm, setDeactivateConfirm] = useState("");

  const handleDeactivateRestaurant = async () => {
    if (isDemo) { toast.info(t('dashboard.settings.demo_unavailable')); return; }
    if (deactivateConfirm !== restaurant.name) {
      toast.error(t('dashboard.settings.name_mismatch'));
      return;
    }
    try {
      const now = new Date().toISOString();
      const deletion = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      await updateRestaurant(restaurant.id, {
        deactivated_at: now,
        scheduled_deletion_at: deletion,
        is_accepting_orders: false,
      } as any);
      toast.success(t('dashboard.settings.restaurant_disabled'));
      window.location.reload();
    } catch (e) {
      toast.error(t('dashboard.settings.disable_error'));
    }
  };

  return (
    <div className="max-w-xl lg:max-w-2xl space-y-6">
      {/* Availability */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Power className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">{t('dashboard.settings.availability')}</h3>
        </div>

        <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
          <div>
            <p className="text-sm font-medium text-foreground">{t('dashboard.settings.accept_orders')}</p>
            <p className="text-xs text-muted-foreground">{isAccepting ? t('dashboard.settings.clients_can_order') : t('dashboard.settings.orders_suspended')}</p>
          </div>
          <Switch checked={isAccepting} onCheckedChange={handleToggleAccepting} />
        </div>

        <div className="space-y-2">
          {availabilityModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setAvailabilityMode(mode.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-start transition-all border ${
                availabilityMode === mode.id ? "border-foreground bg-secondary" : "border-border hover:bg-secondary/50"
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                availabilityMode === mode.id ? "border-foreground" : "border-muted-foreground"
              }`}>
                {availabilityMode === mode.id && <div className="w-2 h-2 rounded-full bg-foreground" />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{mode.label}</p>
                <p className="text-xs text-muted-foreground">{mode.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {availabilityMode === "auto" && !loadingSchedule && (
          <div className="mt-4 pt-4 border-t border-border">
            <ScheduleEditor schedule={schedule} onChange={setSchedule} />
          </div>
        )}
      </section>

      {/* Order modes */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingBag className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">{t('dashboard.settings.order_modes')}</h3>
        </div>

        <div className="space-y-2 mb-4">
          {orderModeOptions.map((opt) => (
            <label key={opt.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={selectedOrderModes.includes(opt.id)}
                onChange={() => toggleOrderMode(opt.id)}
                className="rounded border-muted-foreground"
              />
              <span className="text-sm text-foreground">{opt.label}</span>
            </label>
          ))}
        </div>

        {/* Dine-in capacity */}
        {selectedOrderModes.includes("on_site") && (
          <div className="p-3 rounded-xl bg-secondary/50 space-y-2">
            <label className="text-sm font-medium text-foreground">{t('dashboard.settings.dine_in_capacity')}</label>
            <Input
              type="number"
              min={1}
              max={500}
              value={dineInCapacity}
              onChange={(e) => setDineInCapacity(e.target.value)}
              placeholder="15"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground">{t('dashboard.settings.dine_in_capacity_desc')}</p>
          </div>
        )}

        <div className="space-y-3 pt-3 border-t border-border">
          <div>
            <label className="text-sm text-muted-foreground">{t('dashboard.settings.estimated_time')}</label>
            <Input
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(e.target.value)}
              placeholder="20-30 min"
              className="mt-1"
            />
          </div>
        </div>
      </section>

      {/* Payment methods */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">{t('dashboard.settings.payment_methods')}</h3>
        </div>

        <div className="space-y-2">
          {paymentOptions.map((opt) => (
            <label key={opt.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={paymentMethods.includes(opt.id)}
                onChange={() => togglePayment(opt.id)}
                className="rounded border-muted-foreground"
              />
              <span className="text-sm text-foreground">{opt.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Prep time */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">{t('dashboard.settings.prep_time')}</h3>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-muted-foreground">{t('dashboard.settings.default_time')}</label>
              <span className="text-sm font-medium text-foreground">{prepTime.default_minutes} min</span>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              step={5}
              value={prepTime.default_minutes}
              onChange={(e) => setPrepTime({ ...prepTime, default_minutes: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-muted-foreground">{t('dashboard.settings.extra_item_time')}</label>
              <span className="text-sm font-medium text-foreground">{prepTime.per_item_minutes} min</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={prepTime.per_item_minutes}
              onChange={(e) => setPrepTime({ ...prepTime, per_item_minutes: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">{t('dashboard.settings.max_time')}</label>
            <Input
              type="number"
              value={prepTime.max_minutes}
              onChange={(e) => setPrepTime({ ...prepTime, max_minutes: parseInt(e.target.value) || 90 })}
              className="mt-1"
            />
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">{t('dashboard.settings.notifications')}</h3>
        </div>

        {sound ? (
          <div className="space-y-4">
            {/* Mute toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t('dashboard.settings.notification_sound')}</p>
                <p className="text-xs text-muted-foreground">{sound.muted ? t('dashboard.settings.sound_disabled') : t('dashboard.settings.sound_enabled')}</p>
              </div>
              <Switch checked={!sound.muted} onCheckedChange={(val) => sound.setMuted(!val)} />
            </div>

            {!sound.muted && (
              <>
                {/* Volume slider */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm text-muted-foreground flex items-center gap-1.5">
                      {sound.volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                      {t("dashboard.settings.volume")}
                    </label>
                    <span className="text-sm font-medium text-foreground">{sound.volume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={sound.volume}
                    onChange={(e) => sound.setVolume(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Repeat toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t('dashboard.settings.repeat_sound')}</p>
                    <p className="text-xs text-muted-foreground">{t('dashboard.settings.repeat_sound_desc')}</p>
                  </div>
                  <Switch checked={sound.repeatEnabled} onCheckedChange={sound.setRepeatEnabled} />
                </div>
              </>
            )}

            {/* Test button */}
            <Button
              variant="outline"
              size="sm"
              onClick={sound.testPlay}
              className="rounded-xl gap-2"
            >
              <Play className="h-3.5 w-3.5" />
              {t('dashboard.settings.test_sound')}
            </Button>

            {!sound.audioUnlocked && (
              <p className="text-xs text-amber-600">
                {t('dashboard.settings.sound_info')}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        )}
      </section>

      {/* Save button */}
      <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl h-12">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('dashboard.settings.save_all')}
      </Button>

      {/* Account */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">{t('dashboard.settings.my_account')}</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">{t('dashboard.settings.phone')}</label>
            <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="mt-1" />
          </div>

          <Button variant="outline" className="w-full rounded-xl gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />{t('dashboard.settings.logout')}
          </Button>
        </div>
      </section>

      {/* Subscription / Abonnement */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">{t('dashboard.settings.my_subscription')}</h3>
        </div>

        {subscription ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.settings.plan')}</span>
              <span className="text-sm font-medium text-foreground">
                {subscription.plan === "annual" ? t('dashboard.settings.annual') : t('dashboard.settings.monthly')}{" "}
                ({PLAN_PRICES[subscription.plan].toFixed(2)} €/{subscription.plan === "annual" ? t("dashboard.settings.annual_short") : t("dashboard.settings.monthly_short")})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.settings.status')}</span>
              <span className={`text-sm font-medium ${
                subscription.status === "active" || subscription.status === "promo"
                  ? "text-green-600"
                  : subscription.status === "trial"
                  ? "text-blue-600"
                  : subscription.status === "past_due"
                  ? "text-red-600"
                  : "text-amber-600"
              }`}>
                {subscription.status === "active" ? t('dashboard.settings.status_active') :
                 subscription.status === "trial" ? t('dashboard.settings.status_trial') :
                 subscription.status === "past_due" ? t('dashboard.settings.status_pending') :
                 subscription.status === "cancelled" ? t('dashboard.settings.status_cancelled') :
                 subscription.status === "expired" ? t('dashboard.settings.status_expired') :
                 subscription.status === "promo" ? t('dashboard.settings.status_promo') :
                 t('dashboard.settings.status_waiting')}
              </span>
            </div>
            {subscription.trial_end && subscription.status === "trial" && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('dashboard.settings.trial_end')}</span>
                <span className="text-sm font-medium text-foreground">
                  {new Date(subscription.trial_end).toLocaleDateString(locale)}
                </span>
              </div>
            )}
            {subscription.billing_day && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('dashboard.settings.billing')}</span>
                <span className="text-sm text-foreground">
                  {subscription.plan === "annual"
                    ? t('dashboard.settings.billing_desc_annual', { day: subscription.billing_day === 1 ? t('dashboard.settings.first_ordinal') : String(subscription.billing_day) })
                    : t('dashboard.settings.billing_desc_monthly', { day: subscription.billing_day === 1 ? t('dashboard.settings.first_ordinal') : String(subscription.billing_day) })}
                </span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
                <a href="https://idwzsh-11.myshopify.com/account" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t('dashboard.settings.manage')}
                </a>
              </Button>
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link to="/choisir-plan">{t('dashboard.settings.change_plan')}</Link>
              </Button>
            </div>

            {/* Promo code input */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{t('dashboard.settings.promo_code')}</span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder="LANCEMENT"
                  className="flex-1 h-9 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApplyPromo}
                  disabled={promoLoading || !promoInput.trim()}
                >
                  {promoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('common.apply')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              {t('dashboard.settings.no_subscription')}
            </p>
            <Button size="sm" asChild>
              <Link to="/choisir-plan">{t('dashboard.settings.choose_plan')}</Link>
            </Button>
          </div>
        )}
      </section>

      {/* Referral / Parrainage */}
      <ReferralSection restaurantId={restaurant.id} />

      {/* Danger zone */}
      <section className="bg-card rounded-2xl border border-destructive/30 p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="text-base font-semibold text-destructive">{t('dashboard.settings.disable_restaurant')}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          {t('dashboard.settings.disable_info')}
        </p>
        <p className="text-sm text-muted-foreground mb-3">
          {t('dashboard.settings.disable_confirm')} <span className="font-semibold text-foreground">{restaurant.name}</span>
        </p>
        <Input
          placeholder={restaurant.name}
          value={deactivateConfirm}
          onChange={(e) => setDeactivateConfirm(e.target.value)}
          className="mb-3"
        />
        <Button
          variant="destructive"
          className="w-full rounded-xl gap-2"
          onClick={handleDeactivateRestaurant}
          disabled={deactivateConfirm !== restaurant.name}
        >
          <Trash2 className="h-4 w-4" />{t('dashboard.settings.disable_button')}
        </Button>
      </section>
    </div>
  );
};
