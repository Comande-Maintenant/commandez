import { Link } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";

const NotFound = () => {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t("errors.not_found_title")}</p>
        <Link to="/" className="text-sm text-foreground underline hover:opacity-80">
          {t("errors.back_home")}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
