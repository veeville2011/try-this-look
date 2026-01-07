import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/**
 * Reusable Navigation Bar Component
 * Used across all main pages for consistent navigation
 */
const NavigationBar = () => {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <nav 
      className="bg-card border-b border-border" 
      role="navigation" 
      aria-label={t("navigation.mainNavigation") || "Main navigation"}
    >
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
                to="/analytics"
                className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                  location.pathname === "/analytics"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={t("navigation.analytics") || "Analytics"}
              >
                {t("navigation.analytics") || "Analytics"}
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
  );
};

export default NavigationBar;

