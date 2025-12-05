import { CartOutfitMode } from "@/types/cartOutfit";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Shirt } from "lucide-react";
import { Card } from "@/components/ui/card";

interface CartOutfitModeSelectorProps {
  mode: CartOutfitMode;
  onModeChange: (mode: CartOutfitMode) => void;
  disabled?: boolean;
}

export default function CartOutfitModeSelector({
  mode,
  onModeChange,
  disabled = false,
}: CartOutfitModeSelectorProps) {
  return (
    <Card className="p-3 sm:p-4 border-border bg-card">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm sm:text-base font-semibold">
          Mode de Génération
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={mode === "cart" ? "default" : "outline"}
          onClick={() => !disabled && onModeChange("cart")}
          disabled={disabled}
          className={`h-auto py-3 px-4 flex flex-col items-center gap-2 transition-all duration-200 ${
            mode === "cart"
              ? "bg-primary text-primary-foreground shadow-md"
              : "hover:bg-muted"
          } disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
          aria-label="Mode Panier - Générer des images individuelles pour chaque article"
          aria-pressed={mode === "cart"}
        >
          <ShoppingCart
            className={`h-5 w-5 sm:h-6 sm:w-6 ${
              mode === "cart" ? "text-primary-foreground" : "text-muted-foreground"
            }`}
            aria-hidden="true"
          />
          <div className="text-center">
            <div className="text-xs sm:text-sm font-semibold">Mode Panier</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              1-6 articles
            </div>
          </div>
        </Button>
        <Button
          variant={mode === "outfit" ? "default" : "outline"}
          onClick={() => !disabled && onModeChange("outfit")}
          disabled={disabled}
          className={`h-auto py-3 px-4 flex flex-col items-center gap-2 transition-all duration-200 ${
            mode === "outfit"
              ? "bg-primary text-primary-foreground shadow-md"
              : "hover:bg-muted"
          } disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
          aria-label="Mode Tenue Complète - Générer une seule image combinée"
          aria-pressed={mode === "outfit"}
        >
          <Shirt
            className={`h-5 w-5 sm:h-6 sm:w-6 ${
              mode === "outfit"
                ? "text-primary-foreground"
                : "text-muted-foreground"
            }`}
            aria-hidden="true"
          />
          <div className="text-center">
            <div className="text-xs sm:text-sm font-semibold">
              Mode Tenue
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              2-8 articles
            </div>
          </div>
        </Button>
      </div>
      <p className="text-[10px] sm:text-xs text-muted-foreground mt-3 text-center">
        {mode === "cart"
          ? "Génère une image séparée pour chaque article sélectionné"
          : "Génère une seule image combinée de tous les articles ensemble"}
      </p>
    </Card>
  );
}

