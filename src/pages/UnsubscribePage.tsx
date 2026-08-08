import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Preferences = {
  marketing_emails: boolean;
  subscription_emails: boolean;
  referral_emails: boolean;
};

const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unsubscribe`;
const apiHeaders = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  "Content-Type": "application/json",
};

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    fetch(`${endpoint}?token=${encodeURIComponent(token)}`, { headers: apiHeaders })
      .then(async (response) => {
        if (!response.ok) throw new Error("invalid_token");
        return response.json();
      })
      .then((data) => {
        setPreferences({
          marketing_emails: data.marketing_emails,
          subscription_emails: data.subscription_emails,
          referral_emails: data.referral_emails,
        });
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  const save = async (unsubscribeAll = false) => {
    if (!preferences) return;
    setStatus("saving");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ token, ...preferences, unsubscribe_all: unsubscribeAll }),
      });
      if (!response.ok) throw new Error("save_failed");
      if (unsubscribeAll) {
        setPreferences({ marketing_emails: false, subscription_emails: false, referral_emails: false });
      }
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-16">
      <section className="mx-auto max-w-lg rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Préférences email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choisissez les messages que vous souhaitez recevoir de CommandeIci.
        </p>

        {status === "loading" && <p className="mt-8">Chargement…</p>}
        {status === "error" && (
          <p className="mt-8 text-sm text-destructive">Ce lien est invalide ou a expiré.</p>
        )}
        {preferences && status !== "error" && (
          <div className="mt-8 space-y-5">
            {([
              ["marketing_emails", "Conseils et nouveautés"],
              ["subscription_emails", "Informations sur mon abonnement"],
              ["referral_emails", "Parrainage et avantages"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={preferences[key]}
                  onCheckedChange={(checked) => setPreferences((current) => current && ({
                    ...current,
                    [key]: checked === true,
                  }))}
                />
                {label}
              </label>
            ))}
            {status === "saved" && <p className="text-sm text-emerald-700">Préférences enregistrées.</p>}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button disabled={status === "saving"} onClick={() => save(false)}>
                Enregistrer
              </Button>
              <Button disabled={status === "saving"} variant="outline" onClick={() => save(true)}>
                Tout désactiver
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
