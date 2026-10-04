import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, UserCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { CustomerAuthModal } from "@/components/CustomerAuthModal";
import { useLanguage } from "@/context/LanguageContext";

export function CustomerAvatar() {
  const { t, language } = useLanguage();
  const { isLoggedIn, profile, signOut } = useCustomerAuth();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const initial = profile?.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <>
      <DropdownMenu dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" aria-label={t('client.title')}>
            {isLoggedIn ? (
              <Avatar className="h-9 w-9 cursor-pointer">
                <AvatarFallback className="bg-white/20 backdrop-blur-md text-white text-sm font-semibold">
                  {initial}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center cursor-pointer">
                <User className="h-4 w-4 text-white/80" />
              </div>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {isLoggedIn ? (
            <>
              <DropdownMenuItem onClick={() => navigate("/profil")} className="min-h-11 cursor-pointer">
                <UserCircle className="h-4 w-4 me-2 shrink-0" />
                {t('client.title')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut()} className="min-h-11 cursor-pointer text-red-600 focus:text-red-600">
                <LogOut className="h-4 w-4 me-2 shrink-0" />
                {t('client.logout')}
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={() => setModalOpen(true)} className="min-h-11 cursor-pointer">
              <User className="h-4 w-4 me-2 shrink-0" />
              {t('auth.login')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CustomerAuthModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultView="login"
      />
    </>
  );
}
