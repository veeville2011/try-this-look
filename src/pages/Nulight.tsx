import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Sparkles, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const Nulight = () => {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar - Horizontal Layout */}
      <nav className="bg-card border-b border-border" role="navigation" aria-label="Main navigation">
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
                  aria-label="Dashboard"
                >
                  Dashboard
                </Link>
                <Link
                  to="/nucopy"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nucopy"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="NU Copy"
                >
                  NU Copy
                </Link>
                <Link
                  to="/nulight"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nulight"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="NU Light"
                >
                  NU Light
                </Link>
                <Link
                  to="/nu3d"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nu3d"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Nu3d"
                >
                  Nu3d
                </Link>
                <Link
                  to="/nuscene"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nuscene"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Nu Scene"
                >
                  Nu Scene
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

      {/* Main Content */}
      <main className="min-h-[calc(100vh-56px)] py-8 sm:py-12 lg:py-16" role="main">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="mb-8 sm:mb-12">
              <div className="flex items-center gap-3 mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 border border-primary/20">
                  <Sparkles className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
                  Nulight
                </h1>
              </div>
              <p className="text-base sm:text-lg text-muted-foreground">
                {t("nulight.description") || "Browse all products from your store"}
              </p>
            </div>

            {/* Info Message */}
            <Card className="p-8 sm:p-12 border-border bg-card">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted">
                  <Package className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                    {t("nulight.info.title") || "Products Management"}
                  </h2>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {t("nulight.info.description") || "Please fetch products from the Dashboard page to view them here."}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Nulight;

