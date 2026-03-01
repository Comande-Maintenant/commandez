import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Phone, Edit2, LogOut, Trash2, ShoppingBag, RefreshCw, ChevronRight, Loader2, KeyRound } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { fetchCustomerOrders, type CustomerProfile } from "@/lib/api";
import { CustomerAuthModal } from "@/components/CustomerAuthModal";
import type { DbOrder } from "@/types/database";
import { toast } from "sonner";

type OrderWithRestaurant = DbOrder & { restaurant: { name: string; slug: string; primary_color: string } };

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

const CustomerProfilePage = () => {
  const navigate = useNavigate();
  const { user, profile, isLoggedIn, isLoading, signOut, updateProfile, deleteAccount, resetPassword } = useCustomerAuth();
  const [orders, setOrders] = useState<OrderWithRestaurant[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      navigate("/");
    }
  }, [isLoading, isLoggedIn, navigate]);

  // Load orders
  useEffect(() => {
    if (!user) return;
    setLoadingOrders(true);
    fetchCustomerOrders(user.id)
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }, [user]);

  // Init edit fields
  useEffect(() => {
    if (profile) {
      setEditName(profile.name);
      setEditPhone(profile.phone || "");
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ name: editName, phone: editPhone || null });
      setEditing(false);
      toast.success("Profil mis a jour");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleReorder = (order: OrderWithRestaurant) => {
    const items = Array.isArray(order.items) ? order.items : [];
    localStorage.setItem("cm_reorder", JSON.stringify({
      restaurant_slug: order.restaurant.slug,
      items,
    }));
    navigate("/" + order.restaurant.slug);
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      toast.success("Profil supprime");
      navigate("/");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleResetPassword = async () => {
    if (!profile?.email) return;
    try {
      await resetPassword(profile.email);
      toast.success("Lien de reinitialisation envoye par email");
    } catch {
      toast.error("Erreur");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isLoggedIn || !profile) return null;

  const initial = profile.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2" aria-label="Retour">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Mon profil</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Profile card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-gray-900 text-white text-lg font-bold">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom" className="h-10" />
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Telephone" type="tel" className="h-10" />
                </div>
              ) : (
                <>
                  <p className="text-lg font-semibold text-gray-900 truncate">{profile.name}</p>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{profile.email}</span>
                  </div>
                  {profile.phone && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{profile.phone}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {editing ? (
            <div className="flex gap-2">
              <Button onClick={handleSaveProfile} disabled={savingProfile} className="flex-1 h-10 text-sm">
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
              <Button variant="outline" onClick={() => { setEditing(false); setEditName(profile.name); setEditPhone(profile.phone || ""); }} className="h-10 text-sm">
                Annuler
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)} className="w-full h-10 text-sm">
              <Edit2 className="h-3.5 w-3.5 mr-2" />
              Modifier mes infos
            </Button>
          )}

          {/* Stats */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-gray-900">{profile.total_orders}</p>
              <p className="text-xs text-gray-500">Commandes</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-gray-900">{Number(profile.total_spent).toFixed(0)} &euro;</p>
              <p className="text-xs text-gray-500">Depense</p>
            </div>
          </div>
        </motion.div>

        {/* Order history */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Historique des commandes</h2>
          {loadingOrders ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
              <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Aucune commande pour le moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const items = Array.isArray(order.items) ? order.items : [];
                const restaurantColor = order.restaurant?.primary_color || "#10B981";
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{order.restaurant?.name || "Restaurant"}</p>
                        <p className="text-xs text-gray-500">{formatRelativeDate(order.created_at)} - #{order.order_number}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{Number(order.total).toFixed(2)} &euro;</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3 line-clamp-1">
                      {items.map((i: any) => `${i.quantity || 1}x ${i.name}`).join(", ")}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReorder(order)}
                        className="flex-1 h-9 text-xs"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Recommander
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/suivi/${order.id}`)}
                        className="h-9 text-xs text-gray-500"
                      >
                        Details
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="space-y-2 pt-4">
          <Button variant="outline" onClick={handleResetPassword} className="w-full h-11 text-sm justify-start">
            <KeyRound className="h-4 w-4 mr-2" />
            Changer mon mot de passe
          </Button>
          <Button variant="outline" onClick={() => signOut()} className="w-full h-11 text-sm justify-start">
            <LogOut className="h-4 w-4 mr-2" />
            Se deconnecter
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full h-11 text-sm justify-start text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer mon profil
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer votre profil ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irreversible. Votre historique de commandes sera dissocie de votre compte.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700">
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default CustomerProfilePage;
