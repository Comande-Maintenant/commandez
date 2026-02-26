import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, LayoutGrid, UtensilsCrossed, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardOrders } from "@/components/dashboard/DashboardOrders";
import { DashboardMenu } from "@/components/dashboard/DashboardMenu";
import { DashboardHours } from "@/components/dashboard/DashboardHours";

const tabs = [
  { id: "orders", label: "Commandes", icon: LayoutGrid },
  { id: "menu", label: "Menu", icon: UtensilsCrossed },
  { id: "hours", label: "Horaires", icon: Clock },
] as const;

type TabId = (typeof tabs)[number]["id"];

const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState<TabId>("orders");

  return (
    <div className="min-h-screen bg-secondary/50">
      {/* Header */}
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-foreground">Istanbul Kebab</h1>
              <p className="text-xs text-muted-foreground">Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--success))]" />
            <span className="text-xs font-medium text-muted-foreground">Ouvert</span>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="dashboard-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                  />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "orders" && <DashboardOrders />}
            {activeTab === "menu" && <DashboardMenu />}
            {activeTab === "hours" && <DashboardHours />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default DashboardPage;
