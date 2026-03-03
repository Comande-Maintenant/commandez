import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, Check, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

const ConnexionPage = () => {
  const { t, changeLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const STATS = [
    { icon: '\uD83D\uDCB0', value: '+12 400\u20AC', label: t('auth.stats_saved') },
    { icon: '\uD83D\uDCE6', value: '1 847', label: t('auth.stats_orders') },
    { icon: '\uD83C\uDFEA', value: '+50', label: t('auth.stats_trust') },
  ];

  const FIRST_LOGIN_STEPS = [
    t('auth.step_create'),
    t('auth.step_menu'),
    t('auth.step_share'),
    t('auth.step_orders'),
  ];

  const isFirstLogin =
    (location.state as any)?.firstLogin || searchParams.get('bienvenue') === '1';
  const resetSuccess = searchParams.get('reset') === '1';
  const redirectTo = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stayConnected, setStayConnected] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  useEffect(() => {
    if (resetSuccess) {
      toast.success(t('auth.password_changed'));
    }
  }, [resetSuccess]);

  const handleSignIn = async () => {
    setError('');
    if (!email.trim()) {
      setError(t('auth.email_required'));
      return;
    }
    if (!password) {
      setError(t('auth.password_required'));
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;

      // Redirect if query param
      if (redirectTo) {
        navigate(redirectTo);
        return;
      }

      // Find user's restaurant and load preferred language
      const userId = data.user?.id;
      if (userId) {
        const { data: restaurants } = await supabase
          .from('restaurants')
          .select('slug, preferred_language')
          .eq('owner_id', userId)
          .limit(1);

        if (restaurants && restaurants.length > 0) {
          if (restaurants[0].preferred_language) {
            changeLanguage(restaurants[0].preferred_language as any);
          }
          navigate(`/admin/${restaurants[0].slug}`);
          return;
        }
      }

      // No restaurant - go to inscription (step 2)
      toast.info(t('auth.complete_creation'));
      navigate('/inscription');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Invalid login credentials')) {
        setError(t('auth.wrong_credentials'));
      } else if (msg.includes('Email not confirmed')) {
        setError(t('auth.email_not_confirmed'));
      } else if (msg.includes('too many requests') || msg.includes('rate limit')) {
        setError(t('auth.too_many_attempts'));
      } else {
        setError(t('auth.generic_error'));
      }
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSignIn();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile header only */}
      <header className="lg:hidden border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <a
            href="https://commandeici.com"
            className="flex items-center gap-2 text-foreground hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-semibold text-lg">commandeici</span>
          </a>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* ── Left Panel (desktop) ── */}
        <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-12 flex-col justify-between relative overflow-hidden">
          {/* Background circles */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-white/5" />
          </div>

          {/* Top: logo + tagline */}
          <div className="relative z-10">
            <a href="https://commandeici.com" className="flex items-center gap-3 mb-16">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">CI</span>
              </div>
              <span className="font-semibold text-xl">commandeici</span>
            </a>

            <h1 className="text-3xl font-bold leading-tight">
              {t('auth.tagline_orders')}
              <br />
              {t('auth.tagline_clients')}
              <br />
              {t('auth.tagline_margins')}
            </h1>
          </div>

          {/* Middle: stats */}
          <div className="relative z-10 space-y-6">
            <p className="text-sm font-medium text-white/60 uppercase tracking-wider">
              {t('auth.current_stats')}
            </p>
            {STATS.map((stat) => (
              <div key={stat.value} className="flex items-start gap-3">
                <span className="text-2xl">{stat.icon}</span>
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-sm text-white/70">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom: testimonial */}
          <div className="relative z-10 border-t border-white/20 pt-6">
            <p className="text-sm italic text-white/80 leading-relaxed">
              "{t('auth.testimonial')}"
            </p>
            <p className="text-sm font-medium mt-3 text-white/60">
              {t('auth.testimonial_author')}
            </p>
          </div>
        </div>

        {/* ── Right Panel (form) ── */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            {/* Mobile mini-message */}
            {!isFirstLogin && (
              <p className="lg:hidden text-sm text-primary font-medium mb-4 text-center">
                {t('auth.zero_commission')}
              </p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <motion.div
                animate={shakeError ? { x: [-8, 8, -8, 8, 0] } : {}}
                transition={{ duration: 0.4 }}
              >
                <div className="space-y-6">
                  {/* Title */}
                  {isFirstLogin ? (
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">{t('auth.welcome')}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('auth.welcome_desc')}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">{t('auth.welcome_back')}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('auth.welcome_back_desc')}
                      </p>
                    </div>
                  )}

                  {/* Form fields */}
                  <div className="space-y-4">
                    {/* Email */}
                    <div className="space-y-1.5">
                      <label htmlFor="login-email" className="text-sm font-medium text-foreground">
                        {t('auth.email')}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                          id="login-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={t('auth.email_placeholder')}
                          disabled={loading}
                          className="flex w-full rounded-xl border-2 border-input bg-background px-3 py-3 pl-10 text-base transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <label htmlFor="login-password" className="text-sm font-medium text-foreground">
                        {t('auth.password')}
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={t('auth.password_placeholder')}
                          disabled={loading}
                          className="flex w-full rounded-xl border-2 border-input bg-background px-3 py-3 pl-10 pr-10 text-base transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Stay connected + Forgot */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={stayConnected}
                          onChange={(e) => setStayConnected(e.target.checked)}
                          className="h-4 w-4 rounded border-input text-primary accent-emerald-600"
                        />
                        <span className="text-sm text-muted-foreground">{t('auth.stay_connected')}</span>
                      </label>
                      <Link
                        to="/mot-de-passe-oublie"
                        className="text-sm text-primary hover:underline"
                      >
                        {t('auth.forgot_password')}
                      </Link>
                    </div>

                    {/* Error */}
                    {error && (
                      <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <span className="text-sm flex-shrink-0">&#9888;&#65039;</span>
                        <p className="text-sm text-destructive">{error}</p>
                      </div>
                    )}

                    {/* Submit */}
                    <Button
                      onClick={handleSignIn}
                      disabled={loading}
                      className="w-full h-12 rounded-xl text-base font-semibold"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : isFirstLogin ? (
                        <>{t('auth.access_space')} {'\u2192'}</>
                      ) : (
                        <>{t('auth.login')} {'\u2192'}</>
                      )}
                    </Button>
                  </div>

                  {/* First login checklist */}
                  {isFirstLogin && (
                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-2.5">
                      <p className="text-sm font-medium text-foreground">{t('auth.what_awaits')}</p>
                      {FIRST_LOGIN_STEPS.map((item) => (
                        <div key={item} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">{item}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-background px-3 text-muted-foreground">{t('common.or')}</span>
                    </div>
                  </div>

                  {/* Create account */}
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">{t('auth.no_account')}</p>
                    <Link
                      to="/inscription"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline mt-1"
                    >
                      {t('auth.create_free')} &rarr;
                    </Link>
                  </div>

                  {/* Demo link */}
                  <div className="text-center">
                    <Link
                      to="/admin/demo"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                    >
                      {t('demo.cta_link')}
                    </Link>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnexionPage;
