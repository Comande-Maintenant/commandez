import { useState, useEffect } from "react";
import { Mail, Send, UserX, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface EmailLog {
  id: string;
  email_type: string;
  recipient_email: string;
  sent_at: string;
  metadata: any;
}

interface EmailTypeStat {
  type: string;
  count: number;
  label: string;
}

const TYPE_LABELS: Record<string, string> = {
  trial_expiring: "Essai expire bientot",
  trial_expired: "Essai expire",
  referral_completed_referrer: "Parrainage (parrain)",
  referral_completed_referee: "Parrainage (filleul)",
  subscription_activated: "Abonnement active",
  payment_failed: "Paiement echoue",
  subscription_cancelled: "Abonnement annule",
  promo_applied: "Code promo",
  comeback_3days: "Comeback J+3",
  comeback_7days: "Comeback J+7",
  prospection_send: "Prospection B2B",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "a l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export const EmailStats = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unsubCount, setUnsubCount] = useState(0);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [logsRes, unsubRes] = await Promise.all([
        supabase
          .from("email_logs")
          .select("id, email_type, recipient_email, sent_at, metadata")
          .order("sent_at", { ascending: false })
          .limit(200),
        supabase
          .from("user_email_preferences")
          .select("id", { count: "exact" })
          .not("unsubscribed_at", "is", null),
      ]);
      setLogs(logsRes.data || []);
      setUnsubCount(unsubRes.count || 0);
    } catch (err) {
      console.error("EmailStats load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <Skeleton className="h-48 rounded-2xl" />;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const totalSent = logs.length;
  const sentToday = logs.filter(l => l.sent_at >= todayStart).length;
  const sentWeek = logs.filter(l => l.sent_at >= weekAgo).length;

  // Group by type
  const typeCounts: Record<string, number> = {};
  logs.forEach(l => {
    typeCounts[l.email_type] = (typeCounts[l.email_type] || 0) + 1;
  });
  const typeStats: EmailTypeStat[] = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      type,
      count,
      label: TYPE_LABELS[type] || type,
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Mail className="h-5 w-5" /> Emails
        </h2>
        <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
          <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Send className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total envoyes</p>
            </div>
            <p className="text-xl font-bold text-foreground">{totalSent}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Aujourd'hui</p>
            </div>
            <p className="text-xl font-bold text-foreground">{sentToday}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Cette semaine</p>
            </div>
            <p className="text-xl font-bold text-foreground">{sentWeek}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <UserX className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Desinscrits</p>
            </div>
            <p className="text-xl font-bold text-foreground">{unsubCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* By type */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Par type</CardTitle>
          </CardHeader>
          <CardContent>
            {typeStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">Aucun email envoye</p>
            ) : (
              <div className="space-y-1.5">
                {typeStats.map(t => (
                  <div key={t.type} className="flex items-center justify-between py-1 border-b last:border-0">
                    <span className="text-sm">{t.label}</span>
                    <Badge variant="secondary" className="text-xs">{t.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent emails */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Derniers envois</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">Aucun email envoye</p>
            ) : (
              <div className="space-y-1.5">
                {logs.slice(0, 10).map(l => (
                  <div key={l.id} className="flex items-center justify-between py-1 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{l.recipient_email}</p>
                      <p className="text-xs text-muted-foreground">{TYPE_LABELS[l.email_type] || l.email_type}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{timeAgo(l.sent_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
