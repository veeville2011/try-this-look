import { useTranslation } from "react-i18next";
import NavigationBar from "@/components/NavigationBar";
import { BarChart3, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const Analytics = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <NavigationBar />
      <main className="min-h-[calc(100vh-56px)] py-8" role="main">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Card className="border-border">
              <CardContent className="flex flex-col items-center justify-center py-16 px-4 sm:px-8">
                <div className="mb-6 p-4 rounded-full bg-muted">
                  <BarChart3 className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {t("analytics.comingSoon") || "Coming Soon"}
                  </h1>
                </div>
                <p className="text-center text-muted-foreground text-base sm:text-lg max-w-md">
                  {t("analytics.description") || "Analytics dashboard is currently under development. Check back soon for insights and metrics."}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Analytics;

