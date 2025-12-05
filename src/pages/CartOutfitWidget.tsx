import { useEffect, useState } from "react";
import CartOutfitWidget from "@/components/CartOutfitWidget";
import { ProductImage } from "@/types/tryon";

export default function CartOutfitWidgetPage() {
  const [cartItems, setCartItems] = useState<ProductImage[]>([]);
  const [initialMode, setInitialMode] = useState<"cart" | "outfit">("cart");

  useEffect(() => {
    // Extract query parameters from URL
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    if (mode === "outfit" || mode === "cart") {
      setInitialMode(mode);
    }

    // Listen for cart items from parent window
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "NUSENSE_CART_ITEMS") {
        const items = event.data.items || [];
        const productImages: ProductImage[] = items.map((item: any) => ({
          url: item.url,
          id: item.id || item.variantId,
        }));
        setCartItems(productImages);
      }
    };

    window.addEventListener("message", handleMessage);

    // Request cart items from parent window
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: "NUSENSE_REQUEST_CART_ITEMS" },
        "*"
      );
    }

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return (
    <div className="w-full h-full" style={{ backgroundColor: "#fef3f3" }}>
      {/* Cart & Outfit Widget Content */}
      {/* 
        Cart items are extracted from the Shopify cart page (parent window) 
        when the widget is loaded in an iframe. The widget requests cart items 
        from the parent window, which extracts them using Cart Ajax API or DOM.
      */}
      <CartOutfitWidget
        isOpen={true}
        initialMode={initialMode}
        cartItems={cartItems}
      />
    </div>
  );
}

