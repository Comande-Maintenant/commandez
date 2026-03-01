import { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  createOwner,
  createRestaurantFromOnboarding,
  createMenuItemsFromAnalysis,
  generateSlug,
} from '@/services/onboarding';
import { processReferral } from '@/services/referral';
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
  website: string;
  hours: string;
  rating: number | null;
  google_place_id: string;
};

const STEP_LABELS = ['Compte', 'Restaurant', 'Carte', 'Design', 'Formule', 'Termine'];

const slideVariants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

const InscriptionPage = () => {
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

  // Final creation loading
  const [creating, setCreating] = useState(false);

  // ---- Step 1: Create account ----
  const handleSignUp = async () => {
    setAccountError('');
    if (!email || !password) {
      setAccountError('Email et mot de passe requis.');
      return;
    }
    if (password.length < 6) {
      setAccountError('Le mot de passe doit contenir au moins 6 caracteres.');
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
        setAccountError('Cet email est deja utilise. Connectez-vous ou utilisez un autre email.');
      } else {
        setAccountError(msg || 'Erreur lors de l\'inscription.');
      }
    } finally {
      setAccountLoading(false);
    }
  };

  // ---- Step 2: Place selected ----
  const handlePlaceSelect = async (place: GooglePlaceResult) => {
    setSelectedPlace(place);
  };

  const handlePlaceConfirm = (data: RestaurantData) => {
    setRestaurantData(data);
    setStep(3);
  };

  const handleManualSubmit = (data: { name: string; address: string; city: string; phone?: string; cuisine: string }) => {
    setRestaurantData({
      name: data.name,
      address: data.address,
      city: data.city,
      phone: data.phone ?? '',
      cuisine: data.cuisine,
      website: '',
      hours: '',
      rating: null,
      google_place_id: '',
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

  // ---- Step 5: Create everything ----
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
      });

      // Create menu items if any
      if (menuCategories.length > 0) {
        await createMenuItemsFromAnalysis(restaurant.id, menuCategories);
      }

      // Process referral code if present
      if (refCode) {
        await processReferral(restaurant.id, refCode).catch(() => {});
      }

      // Send welcome email (fire-and-forget, non-blocking)
      supabase.functions.invoke("send-welcome-email", {
        body: { restaurantName: restaurantData?.name ?? '', slug, email },
      }).catch((err) => console.warn("[welcome-email] Failed to send:", err));

      setCreatedSlug(slug);
      setCreatedName(restaurantData?.name ?? '');
      setStep(6);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la creation. Veuillez reessayer.');
    } finally {
      setCreating(false);
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
          {step < 6 && (
            <span className="text-xs text-muted-foreground">Etape {step}/5</span>
          )}
        </div>
      </header>

      {step < 6 && (
        <StepIndicator steps={6} current={step} labels={STEP_LABELS} />
      )}

      <main className="max-w-lg mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* STEP 1: Account */}
          {step === 1 && (
            <motion.div key="step1" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                <h2 className="text-xl font-bold text-foreground">Creez votre compte</h2>
                <p className="text-sm text-muted-foreground">
                  En quelques minutes, votre restaurant sera en ligne.
                </p>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    placeholder="6 caracteres minimum"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Telephone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06 12 34 56 78"
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
                  {accountLoading ? 'Creation en cours...' : 'Creer mon compte'}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Deja un compte ?{' '}
                  <Link to="/connexion" className="text-foreground underline">
                    Se connecter
                  </Link>
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Find restaurant */}
          {step === 2 && !selectedPlace && (
            <motion.div key="step2" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                <h2 className="text-xl font-bold text-foreground">Trouvez votre restaurant</h2>

                <div className="flex gap-2">
                  <Button
                    variant={searchMode === 'search' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSearchMode('search')}
                  >
                    Recherche
                  </Button>
                  <Button
                    variant={searchMode === 'nearby' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSearchMode('nearby')}
                  >
                    Autour de moi
                  </Button>
                  <Button
                    variant={searchMode === 'manual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSearchMode('manual')}
                  >
                    Manuel
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
              </div>
            </motion.div>
          )}

          {/* STEP 2b: Confirm place */}
          {step === 2 && selectedPlace && (
            <motion.div key="step2b" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-bold text-foreground mb-4">Confirmez les informations</h2>
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
                <h2 className="text-xl font-bold text-foreground mb-2">Importez votre carte</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Prenez en photo votre carte ou deposez une image. Nous extrairons automatiquement tous vos plats, prix et supplements.
                </p>
                <MenuUpload
                  onAnalysisComplete={handleAnalysisComplete}
                  onSkip={() => setStep(4)}
                />
              </div>
            </motion.div>
          )}

          {/* STEP 3b: Review menu */}
          {step === 3 && menuCategories.length > 0 && (
            <motion.div key="step3b" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-bold text-foreground mb-2">Verifiez votre carte</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Nous avons detecte les elements suivants. Modifiez si necessaire.
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
                  <h2 className="text-xl font-bold text-foreground">Personnalisez</h2>
                  <p className="text-sm text-muted-foreground">
                    Choisissez les couleurs et ajoutez une description.
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
                  <Label>Description du restaurant (optionnel)</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Quelques mots sur votre restaurant..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>URL du logo (optionnel)</Label>
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                    Retour
                  </Button>
                  <Button onClick={() => setStep(5)} className="flex-1">
                    Continuer
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 5: Pricing */}
          {step === 5 && (
            <motion.div key="step5" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="max-w-4xl -mx-[calc((100vw-32rem)/2+1rem)] sm:mx-0">
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-bold text-foreground mb-2">Choisissez votre formule</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Selectionnez la formule qui vous convient. Sans engagement, resiliable a tout moment.
                </p>
                <PricingCards
                  onSelect={handlePlanSelect}
                  selected={selectedPlan}
                />
                {creating && (
                  <div className="text-center mt-4">
                    <p className="text-sm text-muted-foreground animate-pulse">
                      Creation de votre page en cours...
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 6: Success */}
          {step === 6 && (
            <motion.div key="step6" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <OnboardingSuccess restaurantName={createdName} slug={createdSlug} />
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
