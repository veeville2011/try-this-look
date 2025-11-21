/**
 * Quick Actions Component
 * Provides prominent buttons for most common user tasks
 */

import { Button } from "@/components/ui/button";
import { ExternalLink, Settings, CreditCard, HelpCircle } from "lucide-react";
import { useShop } from "@/providers/AppBridgeProvider";
import { redirectToPlanSelection } from "@/utils/managedPricing";

interface QuickActionsProps {
  onInstallClick?: () => void;
  onConfigureClick?: () => void;
  showInstall?: boolean;
  showConfigure?: boolean;
}

const QuickActions = ({
  onInstallClick,
  onConfigureClick,
  showInstall = true,
  showConfigure = false,
}: QuickActionsProps) => {
  const shop = useShop();

  const handlePricingClick = () => {
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");
    if (shopDomain) {
      redirectToPlanSelection(shopDomain);
    }
  };

  const handleHelpClick = () => {
    // Open help/documentation in new tab
    window.open("https://docs.nusense-tryon.com", "_blank");
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Install/Configure Widget Button */}
      {(showInstall || showConfigure) && (
        <Button
          size="lg"
          onClick={showConfigure ? onConfigureClick : onInstallClick}
          className="h-auto py-6 flex flex-col items-center justify-center gap-2"
          variant={showConfigure ? "default" : "default"}
        >
          <Settings className="w-6 h-6" />
          <span className="font-semibold">
            {showConfigure ? "Configure Widget" : "Install Widget"}
          </span>
          <span className="text-xs opacity-90 font-normal">
            {showConfigure
              ? "Customize your try-on widget"
              : "Get started in minutes"}
          </span>
        </Button>
      )}

      {/* View Pricing Button */}
      <Button
        size="lg"
        onClick={handlePricingClick}
        variant="outline"
        className="h-auto py-6 flex flex-col items-center justify-center gap-2 border-2"
      >
        <CreditCard className="w-6 h-6" />
        <span className="font-semibold">View Pricing Plans</span>
        <span className="text-xs opacity-90 font-normal">
          Choose your plan
        </span>
      </Button>

      {/* Get Help Button */}
      <Button
        size="lg"
        onClick={handleHelpClick}
        variant="outline"
        className="h-auto py-6 flex flex-col items-center justify-center gap-2 border-2"
      >
        <HelpCircle className="w-6 h-6" />
        <span className="font-semibold">Get Help</span>
        <span className="text-xs opacity-90 font-normal">
          Documentation & support
        </span>
      </Button>
    </div>
  );
};

export default QuickActions;

