import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { store } from "@/store/store";
import { AppBridgeProvider } from "@/providers/AppBridgeProvider";
import { modelManager } from "@/utils/modelManager";
import Index from "./pages/Index";
import ProductDemo from "./pages/ProductDemo";
import Widget from "./pages/Widget";
import NewWidget from "./pages/NewWidget";
import NewWidgetV1 from "./testComponents/pages/NewWidgetV1";
import NotFound from "./pages/NotFound";
import PaymentSuccess from "./pages/PaymentSuccess";
import Nucopy from "./pages/Nucopy";
import Nulight from "./pages/Nulight";
import Nu3d from "./pages/Nu3d";
import Nuscene from "./pages/Nuscene";
import Referrals from "./pages/Referrals";
import Analytics from "./pages/Analytics";
import AnalyticsDetails from "./pages/AnalyticsDetails";

const queryClient = new QueryClient();

/**
 * Main App Component
 * App Bridge is only used on the "/" route for pricing implementation
 * 
 * Preloads AI models on app initialization for better performance
 */
const App = () => {
  // Preload AI models in the background when app starts
  // This ensures models are ready when users open the virtual try-on modal
  useEffect(() => {
    const preloadModels = async () => {
      try {
        console.log('[App] Starting model preload in background...');
        const startTime = Date.now();
        
        await modelManager.preloadModels();
        
        const loadTime = Date.now() - startTime;
        console.log(`[App] Models preloaded successfully in ${loadTime}ms`);
        
        // Log debug info
        const debugInfo = modelManager.getDebugInfo();
        console.log('[App] Model Manager Debug Info:', debugInfo);
      } catch (err) {
        console.error('[App] Error preloading models (non-critical):', err);
        // Non-critical error - models will load on-demand if preload fails
      }
    };

    // Start preloading in background (non-blocking)
    preloadModels();
  }, []);

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Only "/" route uses App Bridge for pricing */}
              <Route
                path="/"
                element={
                  <AppBridgeProvider>
                    <Index />
                  </AppBridgeProvider>
                }
              />
              <Route
                path="/referrals"
                element={
                  <AppBridgeProvider>
                    <Referrals />
                  </AppBridgeProvider>
                }
              />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/analytics/:id" element={<AnalyticsDetails />} />
              <Route path="/demo" element={<ProductDemo />} />
              <Route path="/widget" element={<Widget />} />
              <Route path="/widget-test" element={<NewWidget />} />
              <Route path="/widget-test-v1" element={<NewWidgetV1 />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/nucopy" element={<Nucopy />} />
              <Route path="/nulight" element={<Nulight />} />
              <Route path="/nu3d" element={<Nu3d />} />
              <Route path="/nuscene" element={<Nuscene />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </Provider>
  );
};

export default App;
