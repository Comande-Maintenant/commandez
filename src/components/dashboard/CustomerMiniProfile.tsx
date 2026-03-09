import { useState, useEffect } from "react";
import { X, Flag, Phone, Mail, ShoppingBag, Calendar, Star, Save, Edit2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { updateCustomerNote, banCustomer, unbanCustomer, fetchCustomerByPhone } from "@/lib/api";
import { formatRelativeTime } from "@/lib/formatOrderTime";
import type { DbCustomer } from "@/types/database";
import { BanDialog } from "./BanDialog";
import { toast } from "sonner";

interface Props {
  customer: DbCustomer;
  restaurantId: string;
  onClose: () => void;
  onUpdated: (updated: DbCustomer) => void;
}

const LOCALE_MAP: Record<string, string> = {
  fr: "fr-FR", en: "en-US", es: "es-ES", de: "de-DE", it: "it-IT",
  pt: "pt-PT", nl: "nl-NL", ar: "ar-SA", zh: "zh-CN", ja: "ja-JP",
  ko: "ko-KR", ru: "ru-RU", tr: "tr-TR", vi: "vi-VN",
};

export const CustomerMiniProfile = ({ customer, restaurantId, onClose, onUpdated }: Props) => {
  const { t, language } = useLanguage();
  const locale = LOCALE_MAP[language] || "fr-FR";

  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(customer.notes || "");
  const [flagged, setFlagged] = useState(customer.flagged || false);
  const [saving, setSaving] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);

  useEffect(() => {
    setNote(customer.notes || "");
    setFlagged(customer.flagged || false);
    setEditing(false);
  }, [customer.id]);

  const handleSaveNote = async () => {
    setSaving(true);
    try {
      await updateCustomerNote(customer.id, note, flagged);
      onUpdated({ ...customer, notes: note, flagged });
      setEditing(false);
      toast.success(t("customer.note.saved"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleUnban = async () => {
    try {
      await unbanCustomer(customer.id);
      onUpdated({ ...customer, is_banned: false, banned_at: null, banned_reason: "" });
      toast.success(t("customer.ban.unbanned"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  };

  const timeSince = (d: string | null) => formatRelativeTime(d, language, t);

  const initials = customer.customer_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 z-[60]"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 end-0 z-[60] w-full max-w-sm bg-background shadow-xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-base font-bold text-foreground">{t("customer.profile.title")}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Identity */}
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground truncate">{customer.customer_name}</p>
                {customer.is_banned && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{t("customer.badge.banned")}</span>
                )}
                {customer.flagged && !customer.is_banned && (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                )}
                {customer.total_orders >= 10 && !customer.is_banned && (
                  <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                )}
              </div>
              {customer.customer_email && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Mail className="h-3 w-3" /> {customer.customer_email}
                </p>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3" /> {customer.customer_phone}
              </p>
            </div>
          </div>

          {/* Ban status */}
          {customer.is_banned && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm font-medium text-red-800">
                {t("customer.ban.status", { date: formatDate(customer.banned_at) })}
              </p>
              {customer.banned_reason && (
                <p className="text-xs text-red-600 mt-1">{customer.banned_reason}</p>
              )}
              {customer.ban_expires_at && (
                <p className="text-xs text-red-500 mt-1">
                  {t("customer.ban.expires", { date: formatDate(customer.ban_expires_at) })}
                </p>
              )}
              <button
                onClick={handleUnban}
                className="mt-2 text-xs font-medium text-red-700 underline hover:no-underline"
              >
                {t("customer.ban.unban")}
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-secondary/50">
              <p className="text-[11px] text-muted-foreground">{t("customer.profile.since")}</p>
              <p className="text-sm font-semibold text-foreground">{formatDate(customer.first_order_at)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-secondary/50">
              <p className="text-[11px] text-muted-foreground">{t("customer.profile.last_order")}</p>
              <p className="text-sm font-semibold text-foreground">{timeSince(customer.last_order_at)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-secondary/50">
              <p className="text-[11px] text-muted-foreground">{t("customer.profile.orders_count")}</p>
              <p className="text-sm font-semibold text-foreground">{customer.total_orders}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-secondary/50">
              <p className="text-[11px] text-muted-foreground">{t("customer.profile.avg_basket")}</p>
              <p className="text-sm font-semibold text-foreground blur-sensitive">{Number(customer.average_basket).toFixed(2)} €</p>
            </div>
          </div>

          {/* Favorite items */}
          {customer.favorite_items && customer.favorite_items.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">{t("customer.profile.top_items")}</p>
              <div className="flex flex-wrap gap-1.5">
                {customer.favorite_items.slice(0, 5).map((item, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full bg-secondary text-foreground">{item}</span>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase">{t("customer.note.title")}</p>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                >
                  <Edit2 className="h-3 w-3" />
                  {customer.notes ? t("customer.note.edit") : t("customer.note.add")}
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("customer.note.placeholder")}
                  className="w-full p-3 text-sm rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={3}
                  autoFocus
                />
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={flagged}
                    onChange={(e) => setFlagged(e.target.checked)}
                    className="rounded border-border"
                  />
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-foreground">{t("customer.note.flagged")}</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNote}
                    disabled={saving}
                    className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {t("customer.note.save")}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setNote(customer.notes || ""); setFlagged(customer.flagged || false); }}
                    className="px-4 py-2 rounded-xl bg-secondary text-foreground text-sm font-medium"
                  >
                    {t("customer.note.cancel")}
                  </button>
                </div>
              </div>
            ) : customer.notes ? (
              <div className={`p-3 rounded-xl text-sm ${customer.flagged ? "bg-red-50 border border-red-200 text-red-900" : "bg-secondary/50 text-foreground"}`}>
                {customer.notes}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">{t("customer.note.empty")}</p>
            )}
          </div>
        </div>

        {/* Footer: Ban action */}
        {!customer.is_banned && (
          <div className="p-4 border-t border-border">
            <button
              onClick={() => setShowBanDialog(true)}
              className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              {t("customer.ban.action")}
            </button>
          </div>
        )}
      </motion.div>

      {/* Ban dialog */}
      {showBanDialog && (
        <BanDialog
          customer={customer}
          onClose={() => setShowBanDialog(false)}
          onBanned={() => {
            setShowBanDialog(false);
            // Refresh customer
            fetchCustomerByPhone(restaurantId, customer.customer_phone).then((c) => {
              if (c) onUpdated(c);
            });
          }}
        />
      )}
    </>
  );
};
