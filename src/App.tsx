import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext";
import { ScrollToTop } from "@/components/ScrollToTop";
import { useCrossDomainAuth } from "@/hooks/useCrossDomainAuth";
import { usePageTracking } from "@/hooks/usePageTracking";

// Static imports: hot paths, small pages
import Index from "./pages/Index";
import RestaurantPage from "./pages/RestaurantPage";
import NotFound from "./pages/NotFound";

// Lazy imports: split into separate chunks
const OrderPage = lazy(() => import("./pages/OrderPage"));
const SuiviPage = lazy(() => import("./pages/SuiviPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const InscriptionPage = lazy(() => import("./pages/InscriptionPage"));
const ConnexionPage = lazy(() => import("./pages/ConnexionPage"));
const MotDePasseOubliePage = lazy(() => import("./pages/MotDePasseOubliePage"));
const ReinitialiserMotDePassePage = lazy(() => import("./pages/ReinitialiserMotDePassePage"));
const AbonnementPage = lazy(() => import("./pages/AbonnementPage"));
const ChoisirPlanPage = lazy(() => import("./pages/ChoisirPlanPage"));
const AbonnementConfirmePage = lazy(() => import("./pages/AbonnementConfirmePage"));
const SuperAdminPage = lazy(() => import("./pages/SuperAdminPage"));
const CustomerProfilePage = lazy(() => import("./pages/CustomerProfilePage"));
const PhotoUploadPage = lazy(() => import("./pages/PhotoUploadPage"));

function PageLoader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid #e5e7eb",
          borderTopColor: "#10B981",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

const queryClient = new QueryClient();

function AuthSync() {
  useCrossDomainAuth();
  return null;
}

function PageTracker() {
  usePageTracking();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
      <CartProvider>
      <CustomerAuthProvider>
        <AuthSync />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <PageTracker />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/inscription" element={<InscriptionPage />} />
              <Route path="/connexion" element={<ConnexionPage />} />
              <Route path="/mot-de-passe-oublie" element={<MotDePasseOubliePage />} />
              <Route path="/reinitialiser-mot-de-passe" element={<ReinitialiserMotDePassePage />} />
              <Route path="/order" element={<OrderPage />} />
              <Route path="/suivi/:orderId" element={<SuiviPage />} />
              <Route path="/admin/:slug" element={<AdminPage />} />
              <Route path="/abonnement" element={<AbonnementPage />} />
              <Route path="/choisir-plan" element={<ChoisirPlanPage />} />
              <Route path="/abonnement-confirme" element={<AbonnementConfirmePage />} />
              <Route path="/super-admin" element={<SuperAdminPage />} />
              <Route path="/upload/:restaurantId" element={<PhotoUploadPage />} />
              <Route path="/profil" element={<CustomerProfilePage />} />
              <Route path="/signup" element={<Navigate to="/inscription" replace />} />
              <Route path="/demo" element={<RestaurantPage />} />
              <Route path="/:slug" element={<RestaurantPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </CustomerAuthProvider>
      </CartProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
