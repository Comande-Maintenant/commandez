import { useState } from 'react';
import { Check, Copy, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface OnboardingSuccessProps {
  restaurantName: string;
  slug: string;
}

export function OnboardingSuccess({ restaurantName, slug }: OnboardingSuccessProps) {
  const [copied, setCopied] = useState(false);
  const publicUrl = `${window.location.origin}/${slug}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
        <Check className="h-8 w-8 text-green-600" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground">
          {restaurantName} est en ligne !
        </h2>
        <p className="text-muted-foreground mt-2">
          Votre page de commande est prete. Partagez-la avec vos clients.
        </p>
      </div>

      {/* Public URL */}
      <div className="flex items-center gap-2 bg-muted rounded-lg p-3 mx-auto max-w-md">
        <span className="text-sm font-mono truncate flex-1 text-foreground">
          {publicUrl}
        </span>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
        <a href={publicUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </a>
      </div>

      {/* Next steps */}
      <div className="bg-card rounded-xl border border-border p-5 text-left max-w-md mx-auto">
        <h3 className="font-semibold text-foreground mb-3">Prochaines etapes</h3>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="bg-foreground text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
            <span>Imprimez votre QR code et posez-le sur vos tables</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-foreground text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
            <span>Personnalisez votre carte dans le tableau de bord</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-foreground text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
            <span>Partagez le lien sur vos reseaux sociaux</span>
          </li>
        </ol>
      </div>

      <Link to={`/admin/${slug}`}>
        <Button className="mt-2">
          Acceder a mon tableau de bord
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </Link>
    </div>
  );
}
