import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Sparkles, Clock } from "lucide-react";

const Nucopy = () => {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar - Horizontal Layout */}
      <nav className="bg-card border-b border-border" role="navigation" aria-label={t("navigation.mainNavigation") || "Main navigation"}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between h-14">
              {/* Navigation Links */}
              <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                <Link
                  to="/"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={t("navigation.dashboard") || "Dashboard"}
                >
                  {t("navigation.dashboard") || "Dashboard"}
                </Link>
                <Link
                  to="/nucopy"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nucopy"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={t("navigation.nuCopy") || "NU Copy"}
                >
                  {t("navigation.nuCopy") || "NU Copy"}
                </Link>
                <Link
                  to="/nulight"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nulight"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={t("navigation.nuLight") || "NU Light"}
                >
                  {t("navigation.nuLight") || "NU Light"}
                </Link>
                <Link
                  to="/nu3d"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nu3d"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={t("navigation.nu3d") || "Nu3d"}
                >
                  {t("navigation.nu3d") || "Nu3d"}
                </Link>
                <Link
                  to="/nuscene"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nuscene"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={t("navigation.nuScene") || "Nu Scene"}
                >
                  {t("navigation.nuScene") || "Nu Scene"}
                </Link>
              </div>

              {/* Language Switcher */}
              <div className="flex items-center ml-4 flex-shrink-0">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Coming Soon Section */}
      <main className="min-h-[calc(100vh-56px)] flex items-center justify-center" role="main">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="space-y-6">
              {/* Icon */}
              <div className="flex justify-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 border border-primary/20">
                  <Sparkles className="w-10 h-10 text-primary" aria-hidden="true" />
                </div>
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground">
                Nucopy
              </h1>

              {/* Coming Soon Badge */}
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted border border-border rounded-full">
                  <Clock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground">
                    {t("common.comingSoon") || "Coming Soon"}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed">
                {t("nucopy.description") || "We're working on something amazing. Stay tuned!"}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Nucopy;

