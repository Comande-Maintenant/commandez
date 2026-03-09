import { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/context/LanguageContext';
import { StepIndicator } from '@/components/onboarding/StepIndicator';
import { GooglePlaceSearch } from '@/components/onboarding/GooglePlaceSearch';
import { NearbyPlaces } from '@/components/onboarding/NearbyPlaces';
import { ManualRestaurantForm } from '@/components/onboarding/ManualRestaurantForm';
import { PlaceConfirmation } from '@/components/onboarding/PlaceConfirmation';
import { MenuUpload } from '@/components/onboarding/MenuUpload';
import { MenuReviewEditor } from '@/components/onboarding/MenuReviewEditor';
import { QuickColorPicker } from '@/components/onboarding/QuickColorPicker';
import { PricingCards } from '@/components/onboarding/PricingCards';
import { OnboardingSuccess } from '@/components/onboarding/OnboardingSuccess';
import { toast } from 'sonner';
import { LanguageSelector } from '@/components/restaurant/LanguageSelector';
import {
  createOwner,
  createRestaurantFromOnboarding,
  createMenuItemsFromAnalysis,
  generateSlug,
  seedCuisineDefaults,
} from '@/services/onboarding';
import { getPlaceDetails } from '@/services/google-places';
import { processReferral } from '@/services/referral';
import { updateRestaurant } from '@/lib/api';
import type { ParsedScheduleDay } from '@/utils/parse-google-hours';
import type {
  GooglePlaceResult,
  AnalyzedCategory,
  AnalyzedMenu,
  ExtractedColors,
  SubscriptionPlan,
} from '@/types/onboarding';

type RestaurantData = {
  name: string;
  address: string;
  city: string;
  phone: string;
  cuisine: string;
  cuisine_type?: string;
  website: string;
  hours: string;
  rating: number | null;
  google_place_id: string;
  useAutoHours: boolean;
  parsedSchedule: ParsedScheduleDay[] | null;
};

const slideVariants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

const InscriptionPage = () => {
  const { t, language } = useLanguage();

  const STEP_LABELS = [
    t('auth.signup.step_account'),
    t('auth.signup.step_restaurant'),
    t('auth.signup.step_menu'),
    t('auth.signup.step_design'),
    t('auth.signup.step_plan'),
    t('auth.signup.step_done'),
  ];

  const [searchParams] = useSearchParams();
  const refCode = useMemo(() => searchParams.get('ref') || '', [searchParams]);
  const [step, setStep] = useState(1);

  // If user is already authenticated (e.g. redirected from /connexion), skip to step 2
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setStep(2);
      }
    });
  }, []);

  // Step 1: Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [accountError, setAccountError] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);

  // Step 2: Restaurant
  const [selectedPlace, setSelectedPlace] = useState<GooglePlaceResult | null>(null);
  const [restaurantData, setRestaurantData] = useState<RestaurantData | null>(null);
  const [searchMode, setSearchMode] = useState<'search' | 'nearby' | 'manual'>('search');

  // Step 3: Menu
  const [menuCategories, setMenuCategories] = useState<AnalyzedCategory[]>([]);
  const [extractedColors, setExtractedColors] = useState<ExtractedColors | null>(null);

  // Step 4: Design
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Step 5: Pricing
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('monthly');

  // Step 6: Success
  const [createdSlug, setCreatedSlug] = useState('');
  const [createdName, setCreatedName] = useState('');
  const [createdRestaurantId, setCreatedRestaurantId] = useState('');

  // Final creation loading
  const [creating, setCreating] = useState(false);

  // ---- Step 1: Create account ----
  const handleSignUp = async () => {
    setAccountError('');
    if (!email || !password) {
      setAccountError(t('auth.signup.email_password_required'));
      return;
    }
    if (password.length < 6) {
      setAccountError(t('auth.signup.password_min_length'));
      return;
    }
    setAccountLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { phone } },
      });
      if (error) throw error;
      if (data.user) {
        await createOwner(data.user.id, email, phone);
      }
      setStep(2);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setAccountError(t('auth.signup.email_taken'));
      } else {
        setAccountError(msg || t('auth.signup.signup_error'));
      }
    } finally {
      setAccountLoading(false);
    }
  };

  // ---- Step 2: Place selected → enrich with details ----
  const handlePlaceSelect = async (place: GooglePlaceResult) => {
    try {
      const details = await getPlaceDetails(place.place_id);
      // Merge: keep nearby fields, overlay with details where available
      setSelectedPlace({
        ...place,
        formatted_address: details?.formatted_address || place.formatted_address || place.vicinity,
        formatted_phone_number: details?.formatted_phone_number || place.formatted_phone_number || place.international_phone_number,
        website: details?.website || place.website,
        opening_hours: details?.opening_hours || place.opening_hours,
        rating: details?.rating ?? place.rating,
        types: details?.types || place.types,
      });
    } catch {
      // If details fail, use what we have from nearby search
      setSelectedPlace(place);
    }
  };

  const handlePlaceConfirm = (data: RestaurantData & { cuisine_type?: string }) => {
    setRestaurantData(data);
    setStep(3);
  };

  const handleManualSubmit = (data: { name: string; address: string; city: string; phone?: string; cuisine: string; cuisine_type?: string }) => {
    setRestaurantData({
      name: data.name,
      address: data.address,
      city: data.city,
      phone: data.phone ?? '',
      cuisine: data.cuisine,
      cuisine_type: data.cuisine_type || 'generic',
      website: '',
      hours: '',
      rating: null,
      google_place_id: '',
      useAutoHours: false,
      parsedSchedule: null,
    });
    setStep(3);
  };

  // ---- Step 3: Menu analysis ----
  const handleAnalysisComplete = (menu: AnalyzedMenu, colors?: ExtractedColors) => {
    setMenuCategories(menu.categories);
    if (colors) {
      setExtractedColors(colors);
      setPrimaryColor(colors.primary);
      setBgColor(colors.background);
    }
  };

  const handleMenuConfirm = (categories: AnalyzedCategory[]) => {
    setMenuCategories(categories);
    setStep(4);
  };

  // ---- Step 5: Create restaurant then redirect to plan selection ----
  const handlePlanSelect = async (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setCreating(true);

    try {
      const slug = await generateSlug(restaurantData?.name ?? 'restaurant');

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      const restaurant = await createRestaurantFromOnboarding({
        name: restaurantData?.name ?? '',
        slug,
        address: restaurantData?.address,
        city: restaurantData?.city,
        cuisine: restaurantData?.cuisine,
        cuisine_type: restaurantData?.cuisine_type || 'generic',
        description: description || undefined,
        image: logoUrl || undefined,
        restaurant_phone: restaurantData?.phone,
        rating: restaurantData?.rating ?? undefined,
        google_place_id: restaurantData?.google_place_id || undefined,
        website: restaurantData?.website || undefined,
        hours: restaurantData?.hours || undefined,
        primary_color: primaryColor,
        bg_color: bgColor,
        subscription_plan: plan,
        owner_id: user?.id,
        preferred_language: language,
      });

      // Create menu items if any
      if (menuCategories.length > 0) {
        await createMenuItemsFromAnalysis(restaurant.id, menuCategories);
      }

      // Seed cuisine-specific defaults (garnitures, sauces, config)
      await seedCuisineDefaults(restaurant.id, restaurantData?.cuisine_type || 'generic');

      // Store parsed schedule JSON + set auto mode
      if (restaurantData?.useAutoHours && restaurantData.parsedSchedule) {
        await updateRestaurant(restaurant.id, {
          schedule: restaurantData.parsedSchedule,
          availability_mode: 'auto',
        } as any);
      }

      // Process referral code if present
      if (refCode) {
        await processReferral(restaurant.id, refCode).catch(() => {});
      }

      // Insert pending subscription
      await supabase.from('subscriptions').insert({
        restaurant_id: restaurant.id,
        status: 'pending_payment',
        plan: plan === 'none' ? 'monthly' : plan,
        billing_day: 15,
      });

      // Send welcome email (fire-and-forget, non-blocking)
      supabase.functions.invoke("send-welcome-email", {
        body: { restaurantName: restaurantData?.name ?? '', slug, email },
      }).catch((err) => console.warn("[welcome-email] Failed to send:", err));

      setCreatedSlug(slug);
      setCreatedName(restaurantData?.name ?? '');
      setCreatedRestaurantId(restaurant.id);
      setStep(6);
    } catch (err: any) {
      toast.error(err.message || t('auth.signup.creation_error'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="https://commandeici.com" className="flex items-center gap-2 text-foreground hover:opacity-80">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-semibold text-lg">commandeici</span>
          </a>
          <div className="flex items-center gap-3">
            {step < 6 && (
              <span className="text-xs text-muted-foreground">{t('auth.signup.step_counter', { step })}</span>
            )}
            <LanguageSelector />
          </div>
        </div>
      </header>

      {step < 6 && (
        <StepIndicator steps={6} current={step} labels={STEP_LABELS} />
      )}

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Demo link */}
        {step === 1 && (
          <div className="text-center mb-4">
            <Link
              to="/admin/demo"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
            >
              {t('demo.cta_try')}
            </Link>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* STEP 1: Account */}
          {step === 1 && (
            <motion.div key="step1" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                <h2 className="text-xl font-bold text-foreground">{t('auth.signup.create_account')}</h2>
                <p className="text-sm text-muted-foreground">
                  {t('auth.signup.create_desc')}
                </p>

                <div>
                  <Label htmlFor="email">{t('auth.signup.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.email_placeholder')}
                  />
                </div>

                <div>
                  <Label htmlFor="password">{t('auth.signup.password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.signup.password_placeholder')}
                  />
                </div>

                <div>
                  <Label htmlFor="phone">{t('auth.signup.phone')}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('auth.signup.phone_placeholder')}
                  />
                </div>

                {accountError && (
                  <p className="text-sm text-destructive">{accountError}</p>
                )}

                <Button
                  onClick={handleSignUp}
                  disabled={accountLoading}
                  className="w-full"
                >
                  {accountLoading ? t('auth.signup.creating') : t('auth.signup.create_button')}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  {t('auth.signup.already_account')}{' '}
                  <Link to="/connexion" className="text-foreground underline">
                    {t('auth.signup.login')}
                  </Link>
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Find restaurant */}
          {step === 2 && !selectedPlace && (
            <motion.div key="step2" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                <h2 className="text-xl font-bold text-foreground">{t('auth.signup.find_restaurant')}</h2>

                <div className="flex gap-2">
                  <Button
                    variant={searchMode === 'search' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSearchMode('search')}
                  >
                    {t('auth.signup.search')}
                  </Button>
                  <Button
                    variant={searchMode === 'nearby' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSearchMode('nearby')}
                  >
                    {t('auth.signup.nearby')}
                  </Button>
                  <Button
                    variant={searchMode === 'manual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSearchMode('manual')}
                  >
                    {t('auth.signup.manual')}
                  </Button>
                </div>

                {searchMode === 'search' && (
                  <GooglePlaceSearch onSelect={handlePlaceSelect} />
                )}
                {searchMode === 'nearby' && (
                  <NearbyPlaces onSelect={handlePlaceSelect} />
                )}
                {searchMode === 'manual' && (
                  <ManualRestaurantForm onSubmit={handleManualSubmit} />
                )}

                <Button variant="outline" onClick={() => setStep(1)} className="w-full">
                  {t('auth.signup.back')}
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 2b: Confirm place */}
          {step === 2 && selectedPlace && (
            <motion.div key="step2b" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-bold text-foreground mb-4">{t('auth.signup.confirm_info')}</h2>
                <PlaceConfirmation
                  place={selectedPlace}
                  onConfirm={handlePlaceConfirm}
                  onBack={() => setSelectedPlace(null)}
                />
              </div>
            </motion.div>
          )}

          {/* STEP 3: Menu */}
          {step === 3 && menuCategories.length === 0 && (
            <motion.div key="step3" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-bold text-foreground mb-2">{t('auth.signup.import_menu')}</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('auth.signup.import_desc')}
                </p>
                <MenuUpload
                  onAnalysisComplete={handleAnalysisComplete}
                  onSkip={() => setStep(4)}
                />
                <Button variant="outline" onClick={() => { setSelectedPlace(null); setRestaurantData(null); setStep(2); }} className="w-full mt-4">
                  {t('auth.signup.back')}
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 3b: Review menu */}
          {step === 3 && menuCategories.length > 0 && (
            <motion.div key="step3b" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-bold text-foreground mb-2">{t('auth.signup.review_menu')}</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('auth.signup.review_desc')}
                </p>
                <MenuReviewEditor
                  menu={menuCategories}
                  onConfirm={handleMenuConfirm}
                  onBack={() => setMenuCategories([])}
                />
              </div>
            </motion.div>
          )}

          {/* STEP 4: Design */}
          {step === 4 && (
            <motion.div key="step4" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <div className="bg-card rounded-xl border border-border p-6 space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{t('auth.signup.customize')}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t('auth.signup.customize_desc')}
                  </p>
                </div>

                <QuickColorPicker
                  extractedColors={extractedColors ?? undefined}
                  primaryColor={primaryColor}
                  bgColor={bgColor}
                  onPrimaryChange={setPrimaryColor}
                  onBgChange={setBgColor}
                />

                <div>
                  <Label>{t('auth.signup.restaurant_desc')}</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('auth.signup.restaurant_desc_placeholder')}
                    rows={3}
                  />
                </div>

                <div>
                  <Label>{t('auth.signup.logo_url')}</Label>
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                    {t('auth.signup.back')}
                  </Button>
                  <Button onClick={() => setStep(5)} className="flex-1">
                    {t('order.continue')}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 5: Pricing */}
          {step === 5 && (
            <motion.div key="step5" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="max-w-4xl -mx-[calc((100vw-32rem)/2+1rem)] sm:mx-0">
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-bold text-foreground mb-2">{t('auth.signup.choose_plan')}</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('auth.signup.choose_plan_desc')}
                </p>
                <PricingCards
                  onSelect={handlePlanSelect}
                  selected={selectedPlan}
                />
                {creating && (
                  <div className="text-center mt-4">
                    <p className="text-sm text-muted-foreground animate-pulse">
                      {t('auth.signup.creating_page')}
                    </p>
                  </div>
                )}
                {!creating && (
                  <Button variant="outline" onClick={() => setStep(4)} className="w-full mt-4">
                    {t('auth.signup.back')}
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 6: Success */}
          {step === 6 && (
            <motion.div key="step6" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <OnboardingSuccess
                restaurantName={createdName}
                slug={createdSlug}
                email={email}
                restaurantId={createdRestaurantId}
                plan={selectedPlan}
              />
            </motion.div>
          )}
        </AnimatePresence>
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

export default InscriptionPage;
