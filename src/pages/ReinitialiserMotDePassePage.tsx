import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

function getPasswordStrength(pw: string, t: (key: string) => string) {
  if (!pw || pw.length < 8)
    return { label: t('auth.reset.strength_weak'), color: '#EF4444', percent: 25 };
  let score = 1;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { label: t('auth.reset.strength_medium'), color: '#F59E0B', percent: 55 };
  return { label: t('auth.reset.strength_strong'), color: '#10B981', percent: 100 };
}

const ReinitialiserMotDePassePage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Track if Supabase recovery session is established
  const [pageState, setPageState] = useState<'loading' | 'ready' | 'expired'>('loading');
  const readyRef = useRef(false);

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        readyRef.current = true;
        setPageState('ready');
      }
    });

    // Listen for PASSWORD_RECOVERY event (fires when user clicks email link)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        readyRef.current = true;
        setPageState('ready');
      }
    });

    // Timeout: if no session after 5s, token is expired/invalid
    const timeout = setTimeout(() => {
      if (!readyRef.current) setPageState('expired');
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const strength = getPasswordStrength(password, t);

  const handleReset = async () => {
    setError('');
    if (!password) {
      setError(t('auth.reset.password_required'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.reset.password_min_length'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.reset.passwords_no_match'));
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      navigate('/connexion?reset=1');
    } catch (err: any) {
      setError(err.message || t('auth.reset.reset_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleReset();
  };

  // Expired / invalid token
  if (pageState === 'expired') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
            <Link to="/connexion" className="flex items-center gap-2 text-foreground hover:opacity-80">
              <span className="font-semibold text-lg">commandeici</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground">{t('auth.reset.link_expired')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('auth.reset.link_expired_desc')}
            </p>
            <Link to="/mot-de-passe-oublie">
              <Button className="w-full h-12 rounded-xl mt-2">{t('auth.reset.request_new')}</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Loading state while waiting for Supabase to process the hash
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">{t('auth.reset.verifying')}</p>
        </div>
      </div>
    );
  }

  // Ready: show the new password form
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <Link to="/connexion" className="flex items-center gap-2 text-foreground hover:opacity-80">
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
              <div>
                <h2 className="text-xl font-bold text-foreground">{t('auth.reset.new_password_title')}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('auth.reset.new_password_desc')}
                </p>
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <label htmlFor="new-password" className="text-sm font-medium text-foreground">
                  {t('auth.reset.new_password_label')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('auth.reset.new_password_placeholder')}
                    disabled={loading}
                    className="flex w-full rounded-xl border-2 border-input bg-background px-3 py-3 pl-10 pr-10 text-base transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Strength indicator */}
                {password && (
                  <div className="space-y-1.5 mt-2">
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${strength.percent}%`, backgroundColor: strength.color }}
                      />
                    </div>
                    <p className="text-xs" style={{ color: strength.color }}>
                      {t('auth.reset.strength_prefix')} {strength.label}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                  {t('auth.reset.confirm_password')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('auth.reset.confirm_placeholder')}
                    disabled={loading}
                    className="flex w-full rounded-xl border-2 border-input bg-background px-3 py-3 pl-10 pr-10 text-base transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <span className="text-sm flex-shrink-0">&#9888;&#65039;</span>
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                onClick={handleReset}
                disabled={loading}
                className="w-full h-12 rounded-xl text-base font-semibold"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  t('auth.reset.reset_button')
                )}
              </Button>
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

export default ReinitialiserMotDePassePage;
