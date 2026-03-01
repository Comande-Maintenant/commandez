import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext";
import { ScrollToTop } from "@/components/ScrollToTop";
import { useCrossDomainAuth } from "@/hooks/useCrossDomainAuth";
import Index from "./pages/Index";
import RestaurantPage from "./pages/RestaurantPage";
import OrderPage from "./pages/OrderPage";
import AdminPage from "./pages/AdminPage";
import InscriptionPage from "./pages/InscriptionPage";
import SuiviPage from "./pages/SuiviPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import CustomerProfilePage from "./pages/CustomerProfilePage";
import AbonnementPage from "./pages/AbonnementPage";
import ChoisirPlanPage from "./pages/ChoisirPlanPage";
import AbonnementConfirmePage from "./pages/AbonnementConfirmePage";
import ConnexionPage from "./pages/ConnexionPage";
import MotDePasseOubliePage from "./pages/MotDePasseOubliePage";
import ReinitialiserMotDePassePage from "./pages/ReinitialiserMotDePassePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthSync() {
  useCrossDomainAuth();
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
            <Route path="/profil" element={<CustomerProfilePage />} />
            <Route path="/:slug" element={<RestaurantPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CustomerAuthProvider>
      </CartProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
