import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const ConnexionPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSignIn = async () => {
    setError('');
    if (!email || !password) {
      setError('Email et mot de passe requis.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;

      // Find the user's restaurant to redirect to their dashboard
      const userId = data.user?.id;
      if (userId) {
        const { data: restaurants } = await supabase
          .from('restaurants')
          .select('slug')
          .eq('owner_id', userId)
          .limit(1);

        if (restaurants && restaurants.length > 0) {
          navigate(`/admin/${restaurants[0].slug}`);
          return;
        }
      }

      // No restaurant found - redirect to inscription step 2 (they have an account but no restaurant)
      toast.info('Aucun restaurant trouve. Completez votre inscription.');
      navigate('/inscription');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Invalid login credentials')) {
        setError('Email ou mot de passe incorrect.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Votre email n\'est pas confirme. Verifiez votre boite mail.');
      } else {
        setError(msg || 'Erreur lors de la connexion.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    if (!email) {
      setError('Entrez votre adresse email.');
      return;
    }
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/connexion`,
      });
      if (resetError) throw resetError;
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi du lien.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (resetMode) {
        handleResetPassword();
      } else {
        handleSignIn();
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-80">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-semibold text-lg">commandeici</span>
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          {resetMode ? (
            <>
              <h2 className="text-xl font-bold text-foreground">Mot de passe oublie</h2>
              {resetSent ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Un lien de reinitialisation a ete envoye a <strong>{email}</strong>. Verifiez votre boite mail.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => { setResetMode(false); setResetSent(false); }}
                    className="w-full"
                  >
                    Retour a la connexion
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Entrez votre email, nous vous enverrons un lien pour reinitialiser votre mot de passe.
                  </p>
                  <div>
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="vous@restaurant.fr"
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button
                    onClick={handleResetPassword}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
                  </Button>
                  <button
                    onClick={() => { setResetMode(false); setError(''); }}
                    className="text-xs text-muted-foreground underline w-full text-center"
                  >
                    Retour a la connexion
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-foreground">Connectez-vous</h2>
              <p className="text-sm text-muted-foreground">
                Accedez au tableau de bord de votre restaurant.
              </p>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="vous@restaurant.fr"
                />
              </div>

              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Votre mot de passe"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                onClick={handleSignIn}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Connexion en cours...' : 'Se connecter'}
              </Button>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <button
                  onClick={() => { setResetMode(true); setError(''); }}
                  className="underline"
                >
                  Mot de passe oublie ?
                </button>
                <Link to="/inscription" className="text-foreground underline">
                  Creer un compte
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 mt-12">
        <p className="text-center text-xs text-muted-foreground">
          commandeici
        </p>
      </footer>
    </div>
  );
};

export default ConnexionPage;
