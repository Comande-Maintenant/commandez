import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Page introuvable</p>
        <Link to="/" className="text-sm text-foreground underline hover:opacity-80">
          Retour a l'accueil
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
