import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Mail, Lock } from "lucide-react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
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
  const [view, setView] = useState<View>(defaultView);
  const [email, setEmail] = useState(prefillEmail || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success("Connexion reussie !");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!email || !password) return;
    if (password.length < 6) {
      toast.error("Le mot de passe doit faire au moins 6 caracteres");
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
      toast.success("Profil cree avec succes !");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await resetPassword(email);
      toast.success("Lien de reinitialisation envoye par email");
      setView("login");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
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
            {view === "login" && "Se connecter"}
            {view === "signup" && "Creer mon profil"}
            {view === "reset" && "Mot de passe oublie"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="Email"
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
                placeholder="Mot de passe"
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
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Se connecter"}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button onClick={() => switchView("reset")} className="text-muted-foreground hover:text-foreground underline">
                  Mot de passe oublie ?
                </button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Pas de compte ? Commandez directement, c'est possible sans compte.
              </p>
            </>
          )}

          {view === "signup" && (
            <>
              <Button onClick={handleSignup} disabled={loading || !email || !password} className="w-full h-12">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Creer mon profil"}
              </Button>
              <button onClick={() => switchView("login")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto">
                <ArrowLeft className="h-3 w-3" />
                Deja un compte ? Se connecter
              </button>
            </>
          )}

          {view === "reset" && (
            <>
              <Button onClick={handleReset} disabled={loading || !email} className="w-full h-12">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer le lien"}
              </Button>
              <button onClick={() => switchView("login")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto">
                <ArrowLeft className="h-3 w-3" />
                Retour a la connexion
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
