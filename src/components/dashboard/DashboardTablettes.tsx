import { useState, useEffect } from "react";
import { Tablet, Plus, Pencil, Mail } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchTablets, insertTablet, updateTablet } from "@/lib/api";
import type { DbRestaurant } from "@/types/database";
import type { DbTablet } from "@/types/database";

interface Props {
  restaurant: DbRestaurant;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-red-100 text-red-800",
  maintenance: "bg-amber-100 text-amber-800",
};

function maskSerial(serial: string): string {
  if (serial.length <= 8) return serial;
  return serial.slice(0, 4) + "****" + serial.slice(-4);
}

export const DashboardTablettes = ({ restaurant }: Props) => {
  const { t } = useLanguage();

  const USAGE_LABELS: Record<string, string> = {
    cuisine: t("dashboard.tablets.usage_kitchen"),
    caisse: t("dashboard.tablets.usage_pos"),
    service_client: t("dashboard.tablets.usage_service"),
    autre: t("dashboard.tablets.usage_other"),
  };

  const STATUS_LABELS: Record<string, string> = {
    active: t("dashboard.tablets.status_active"),
    inactive: t("dashboard.tablets.status_inactive"),
    maintenance: t("dashboard.tablets.status_maintenance"),
  };

  const [tablets, setTablets] = useState<DbTablet[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTablet, setEditingTablet] = useState<DbTablet | null>(null);

  // Form state
  const [serialNumber, setSerialNumber] = useState("");
  const [name, setName] = useState("");
  const [usageType, setUsageType] = useState("autre");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTablets = async () => {
    try {
      const data = await fetchTablets(restaurant.id);
      setTablets(data);
    } catch {
      toast.error(t("dashboard.tablets.load_error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTablets();
  }, [restaurant.id]);

  const resetForm = () => {
    setSerialNumber("");
    setName("");
    setUsageType("autre");
    setNotes("");
    setEditingTablet(null);
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (tablet: DbTablet) => {
    setEditingTablet(tablet);
    setSerialNumber(tablet.serial_number);
    setName(tablet.name);
    setUsageType(tablet.usage_type);
    setNotes(tablet.notes);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!serialNumber.trim()) {
      toast.error(t("dashboard.tablets.serial_required"));
      return;
    }
    if (serialNumber.trim().length > 20) {
      toast.error(t("dashboard.tablets.serial_too_long"));
      return;
    }

    setSaving(true);
    try {
      if (editingTablet) {
        await updateTablet(editingTablet.id, {
          serial_number: serialNumber.trim(),
          name: name.trim(),
          usage_type: usageType as DbTablet["usage_type"],
          notes: notes.trim(),
        });
        toast.success(t("dashboard.tablets.updated"));
      } else {
        await insertTablet({
          restaurant_id: restaurant.id,
          serial_number: serialNumber.trim(),
          name: name.trim(),
          usage_type: usageType,
          notes: notes.trim(),
        });
        toast.success(t("dashboard.tablets.added"));
      }
      setDialogOpen(false);
      resetForm();
      await loadTablets();
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("unique") || msg.includes("duplicate")) {
        toast.error(t("dashboard.tablets.serial_exists"));
      } else {
        toast.error(t("dashboard.tablets.save_error"));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (tablet: DbTablet) => {
    try {
      const newStatus = tablet.status === "active" ? "inactive" : "active";
      await updateTablet(tablet.id, {
        status: newStatus,
        deactivated_at: newStatus === "inactive" ? new Date().toISOString() : null,
      });
      toast.success(newStatus === "active" ? t("dashboard.tablets.reactivated") : t("dashboard.tablets.deactivated"));
      await loadTablets();
    } catch {
      toast.error(t("dashboard.tablets.save_error"));
    }
  };

  const activeTablets = tablets.filter((t) => t.status !== "inactive");
  const inactiveTablets = tablets.filter((t) => t.status === "inactive");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t("dashboard.tablets.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("dashboard.tablets.subtitle")}
          </p>
        </div>
        <Button onClick={openAdd} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" />
          {t("dashboard.tablets.add_button")}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">{t("dashboard.tablets.loading")}</div>
      ) : tablets.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-2xl">
          <Tablet className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t("dashboard.tablets.empty_state")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("dashboard.tablets.empty_subtitle")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active / maintenance tablets */}
          {activeTablets.length > 0 && (
            <div className="space-y-3">
              {activeTablets.map((tablet) => (
                <div
                  key={tablet.id}
                  className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4"
                >
                  <div className="flex-shrink-0">
                    <Tablet className="h-8 w-8 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground text-sm">
                        {tablet.name || t("dashboard.tablets.fallback_name")}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[tablet.status]}`}>
                        {STATUS_LABELS[tablet.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      S/N : {maskSerial(tablet.serial_number)} - {USAGE_LABELS[tablet.usage_type]}
                    </p>
                    {tablet.notes && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{tablet.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => openEdit(tablet)}
                      aria-label={t("dashboard.tablets.edit_tablet")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-red-600 hover:text-red-700"
                      onClick={() => handleDeactivate(tablet)}
                    >
                      {t("dashboard.tablets.disable")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Inactive tablets */}
          {inactiveTablets.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t("dashboard.tablets.inactive_section")}
              </h3>
              {inactiveTablets.map((tablet) => (
                <div
                  key={tablet.id}
                  className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 opacity-60"
                >
                  <div className="flex-shrink-0">
                    <Tablet className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground text-sm">
                        {tablet.name || t("dashboard.tablets.fallback_name")}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[tablet.status]}`}>
                        {STATUS_LABELS[tablet.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      S/N : {maskSerial(tablet.serial_number)} - {USAGE_LABELS[tablet.usage_type]}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl flex-shrink-0"
                    onClick={() => handleDeactivate(tablet)}
                  >
                    {t("dashboard.tablets.reactivate")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contact CTA */}
      <div className="bg-secondary/50 rounded-2xl p-5 text-center">
        <p className="text-sm text-muted-foreground mb-2">
          {t("dashboard.tablets.cta_text")}
        </p>
        <a
          href="mailto:contact@commandeici.com?subject=Location tablettes"
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground underline hover:opacity-80"
        >
          <Mail className="h-4 w-4" />
          {t("dashboard.tablets.cta_link")}
        </a>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTablet ? t("dashboard.tablets.edit_tablet") : t("dashboard.tablets.add_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label htmlFor="serial">{t("dashboard.tablets.serial_label")}</Label>
              <Input
                id="serial"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value.slice(0, 20))}
                placeholder="ABC12345678"
                maxLength={20}
              />
            </div>
            <div>
              <Label htmlFor="tablet-name">{t("dashboard.tablets.name_label")}</Label>
              <Input
                id="tablet-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("dashboard.tablets.name_placeholder")}
              />
            </div>
            <div>
              <Label>{t("dashboard.tablets.usage_label")}</Label>
              <Select value={usageType} onValueChange={setUsageType}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cuisine">{t("dashboard.tablets.usage_kitchen")}</SelectItem>
                  <SelectItem value="caisse">{t("dashboard.tablets.usage_pos")}</SelectItem>
                  <SelectItem value="service_client">{t("dashboard.tablets.usage_service")}</SelectItem>
                  <SelectItem value="autre">{t("dashboard.tablets.usage_other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tablet-notes">{t("dashboard.tablets.notes_label")}</Label>
              <Textarea
                id="tablet-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("dashboard.tablets.notes_placeholder")}
                rows={2}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => { setDialogOpen(false); resetForm(); }}
              >
                {t("dashboard.tablets.cancel")}
              </Button>
              <Button
                className="flex-1 rounded-xl"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? t("dashboard.tablets.saving") : editingTablet ? t("dashboard.tablets.save") : t("dashboard.tablets.add_button")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

