import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { store } from "@/store/store";
import { AppBridgeProvider } from "@/providers/AppBridgeProvider";
import Index from "./pages/Index";
import ProductDemo from "./pages/ProductDemo";
import Widget from "./pages/Widget";
import NewWidget from "./pages/NewWidget";
import NotFound from "./pages/NotFound";
import PaymentSuccess from "./pages/PaymentSuccess";
import Nucopy from "./pages/Nucopy";
import Nulight from "./pages/Nulight";
import Nu3d from "./pages/Nu3d";
import Nuscene from "./pages/Nuscene";

const queryClient = new QueryClient();

/**
 * Main App Component
 * App Bridge is only used on the "/" route for pricing implementation
 */
const App = () => {
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
              <Route path="/demo" element={<ProductDemo />} />
              <Route path="/widget" element={<Widget />} />
              <Route path="/widget-test" element={<NewWidget />} />
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
