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

export function CustomerAvatar() {
  const { isLoggedIn, profile, signOut } = useCustomerAuth();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const initial = profile?.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full focus:outline-none" aria-label="Menu profil">
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
              <DropdownMenuItem onClick={() => navigate("/profil")} className="cursor-pointer">
                <UserCircle className="h-4 w-4 mr-2" />
                Mon profil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer text-red-600 focus:text-red-600">
                <LogOut className="h-4 w-4 mr-2" />
                Se deconnecter
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={() => setModalOpen(true)} className="cursor-pointer">
              <User className="h-4 w-4 mr-2" />
              Se connecter
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
