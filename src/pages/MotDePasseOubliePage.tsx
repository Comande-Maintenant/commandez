import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

const MotDePasseOubliePage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleReset = async () => {
    setError('');
    if (!email.trim()) {
      setError('Entrez votre adresse email.');
      return;
    }
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
      });
    } catch {
      // Never reveal if email exists or not
    } finally {
      setLoading(false);
      setSent(true);
      setCountdown(60);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
      });
    } catch {
      // Silent
    } finally {
      setLoading(false);
      setCountdown(60);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !sent) handleReset();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <Link
            to="/connexion"
            className="flex items-center gap-2 text-foreground hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-semibold text-lg">commandeici</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="bg-card rounded-xl border border-border p-6 space-y-5">
              {sent ? (
                <>
                  <div className="text-center">
                    <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Mail className="h-7 w-7 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Email envoye !</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      Si un compte existe avec cette adresse, vous recevrez un lien dans quelques
                      instants.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Pensez a verifier vos spams.
                    </p>
                  </div>

                  <Button
                    onClick={handleResend}
                    disabled={countdown > 0 || loading}
                    variant="outline"
                    className="w-full h-12 rounded-xl"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : countdown > 0 ? (
                      `Renvoyer l'email (${countdown}s)`
                    ) : (
                      "Renvoyer l'email"
                    )}
                  </Button>

                  <Link
                    to="/connexion"
                    className="block text-center text-sm text-primary hover:underline"
                  >
                    &larr; Retour a la connexion
                  </Link>
                </>
              ) : (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Mot de passe oublie ?</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Entrez votre email, on vous envoie un lien de reinitialisation.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="reset-email" className="text-sm font-medium text-foreground">
                      Adresse email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <input
                        id="reset-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="vous@restaurant.fr"
                        disabled={loading}
                        className="flex w-full rounded-xl border-2 border-input bg-background px-3 py-3 pl-10 text-base transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button
                    onClick={handleReset}
                    disabled={loading}
                    className="w-full h-12 rounded-xl text-base font-semibold"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      'Envoyer le lien \u2192'
                    )}
                  </Button>

                  <Link
                    to="/connexion"
                    className="block text-center text-sm text-primary hover:underline"
                  >
                    &larr; Retour a la connexion
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </main>

      <footer className="border-t border-border py-4">
        <p className="text-center text-xs text-muted-foreground">commandeici</p>
      </footer>
    </div>
  );
};

export default MotDePasseOubliePage;
