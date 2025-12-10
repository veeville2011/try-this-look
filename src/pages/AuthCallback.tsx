import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useAppSelector } from "@/store/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

/**
 * AuthCallback Page
 * 
 * Handles OAuth callback after customer authenticates with Shopify.
 * This page processes the authorization code and stores the session token.
 * 
 * Route: /auth/callback
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleCallback, login, error: authError } = useCustomerAuth();
  const authState = useAppSelector((state) => state.customerAuth);
  
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Check if we're in a popup window
        const isPopup = typeof window !== "undefined" && window.opener && window.opener !== window;
        const parentOrigin = typeof window !== "undefined" ? window.location.origin : "";

        // Check for OAuth errors in URL
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        if (error) {
          const errorMsg = errorDescription || error || "Authentication failed";
          setStatus("error");
          setErrorMessage(errorMsg);
          
          // If in popup, send error to parent
          if (isPopup && window.opener) {
            window.opener.postMessage(
              {
                type: "CUSTOMER_AUTH_ERROR",
                error: errorMsg,
                errorCode: error,
              },
              parentOrigin
            );
            // Close popup after short delay
            setTimeout(() => {
              window.close();
            }, 2000);
          }
          return;
        }

        // Check for required parameters
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        if (!code || !state) {
          const errorMsg = "Missing required OAuth parameters. Please try logging in again.";
          setStatus("error");
          setErrorMessage(errorMsg);
          
          // If in popup, send error to parent
          if (isPopup && window.opener) {
            window.opener.postMessage(
              {
                type: "CUSTOMER_AUTH_ERROR",
                error: errorMsg,
              },
              parentOrigin
            );
            setTimeout(() => {
              window.close();
            }, 2000);
          }
          return;
        }

        // Get return_to URL from localStorage (set before login) or URL params
        let returnTo = searchParams.get("return_to");
        if (!returnTo && typeof window !== "undefined" && window.localStorage) {
          returnTo = localStorage.getItem("auth_return_to");
          if (returnTo) {
            localStorage.removeItem("auth_return_to"); // Clean up
          }
        }
        
        if (returnTo) {
          setRedirectUrl(decodeURIComponent(returnTo));
        }

        // Process callback - this updates Redux state
        await handleCallback();
        
        // Get customer info from Redux state after callback completes
        // Wait a brief moment for Redux state to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // If in popup, send success message to parent with customer info
        if (isPopup && window.opener) {
          // Send success message with customer info from Redux state
          window.opener.postMessage(
            {
              type: "CUSTOMER_AUTH_SUCCESS",
              message: "Authentication successful",
              customer: authState.customer,
              sessionToken: authState.sessionToken,
            },
            parentOrigin
          );
          
          // Show success message briefly, then close popup
          setStatus("success");
          setTimeout(() => {
            window.close();
          }, 1500);
          return; // Don't redirect in popup mode
        }

        // Not in popup - standard redirect flow
        // Success - redirect after short delay
        setStatus("success");
        
        // Redirect after 1 second
        setTimeout(() => {
          const finalRedirectUrl = returnTo ? decodeURIComponent(returnTo) : null;
          if (finalRedirectUrl) {
            navigate(finalRedirectUrl, { replace: true });
          } else {
            // Default redirect to widget page or home
            navigate("/widget", { replace: true });
          }
        }, 1000);
      } catch (error) {
        const errorMsg = error instanceof Error
          ? error.message
          : "An unexpected error occurred during authentication";
        setStatus("error");
        setErrorMessage(errorMsg);
        
        // If in popup, send error to parent
        const isPopup = typeof window !== "undefined" && window.opener && window.opener !== window;
        const parentOrigin = typeof window !== "undefined" ? window.location.origin : "";
        if (isPopup && window.opener) {
          window.opener.postMessage(
            {
              type: "CUSTOMER_AUTH_ERROR",
              error: errorMsg,
            },
            parentOrigin
          );
          setTimeout(() => {
            window.close();
          }, 2000);
        }
      }
    };

    processCallback();
  }, [searchParams, handleCallback, navigate, redirectUrl]);

  const handleRetry = () => {
    // Get shop domain from URL or localStorage
    const shopDomain = searchParams.get("shop") || localStorage.getItem("last_shop_domain");
    
    if (shopDomain) {
      login(shopDomain);
    } else {
      // Redirect to home if no shop domain available
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Authentication</CardTitle>
          <CardDescription>Processing your login...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "processing" && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Verifying your authentication...
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-sm font-medium text-foreground">
                Authentication successful!
              </p>
              <p className="text-xs text-muted-foreground">
                Redirecting you now...
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <XCircle className="h-12 w-12 text-destructive" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Authentication Failed
                </p>
                <p className="text-xs text-muted-foreground">
                  {errorMessage || authError || "An error occurred during authentication"}
                </p>
              </div>
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  onClick={() => navigate("/", { replace: true })}
                  className="flex-1"
                >
                  Go Home
                </Button>
                <Button
                  onClick={handleRetry}
                  className="flex-1"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;

