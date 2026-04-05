import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Mail, Lock } from "lucide-react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";

type View = "login" | "signup" | "reset";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultView?: View;
  prefillEmail?: string;
}

export function CustomerAuthModal({ open, onClose, defaultView = "login", prefillEmail }: Props) {
  const { signIn, signUp, resetPassword } = useCustomerAuth();
  const { t } = useLanguage();
  const [view, setView] = useState<View>(defaultView);
  const [email, setEmail] = useState(prefillEmail || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success(t("auth.customer.login_success"));
      onClose();
    } catch (e: any) {
      toast.error(e.message || t("auth.customer.login_error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!email || !password) return;
    if (password.length < 6) {
      toast.error(t("auth.customer.password_too_short"));
      return;
    }
    setLoading(true);
    try {
      // Get name/phone from localStorage
      let name = "";
      let phone = "";
      try {
        const raw = localStorage.getItem("cm_customer");
        if (raw) {
          const saved = JSON.parse(raw);
          name = saved.name || "";
          phone = saved.phone || "";
        }
      } catch { /* ignore */ }
      if (!name) name = email.split("@")[0];

      await signUp(email, password, name, phone);
      toast.success(t("auth.customer.profile_created"));
      onClose();
    } catch (e: any) {
      toast.error(e.message || t("auth.customer.signup_error"));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await resetPassword(email);
      toast.success(t("auth.customer.reset_sent"));
      setView("login");
    } catch (e: any) {
      toast.error(e.message || t("auth.customer.login_error"));
    } finally {
      setLoading(false);
    }
  };

  const switchView = (v: View) => {
    setView(v);
    setPassword("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {view === "login" && t("auth.customer.login_title")}
            {view === "signup" && t("auth.customer.create_title")}
            {view === "reset" && t("auth.customer.forgot_title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder={t("auth.customer.email_placeholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              readOnly={!!prefillEmail && view === "signup"}
            />
          </div>

          {/* Password (not for reset) */}
          {view !== "reset" && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder={t("auth.customer.password_placeholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (view === "login") handleLogin();
                    else if (view === "signup") handleSignup();
                  }
                }}
              />
            </div>
          )}

          {/* Actions */}
          {view === "login" && (
            <>
              <Button onClick={handleLogin} disabled={loading || !email || !password} className="w-full h-12">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.customer.login_button")}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button onClick={() => switchView("reset")} className="text-muted-foreground hover:text-foreground underline">
                  {t("auth.customer.forgot_link")}
                </button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {t("auth.customer.no_account_info")}
              </p>
            </>
          )}

          {view === "signup" && (
            <>
              <Button onClick={handleSignup} disabled={loading || !email || !password} className="w-full h-12">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.customer.create_button")}
              </Button>
              <button onClick={() => switchView("login")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto">
                <ArrowLeft className="h-3 w-3" />
                {t("auth.customer.has_account")}
              </button>
            </>
          )}

          {view === "reset" && (
            <>
              <Button onClick={handleReset} disabled={loading || !email} className="w-full h-12">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.customer.send_link")}
              </Button>
              <button onClick={() => switchView("login")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto">
                <ArrowLeft className="h-3 w-3" />
                {t("auth.customer.back_to_login")}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
