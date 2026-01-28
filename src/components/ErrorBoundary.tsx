import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Log to error tracking service if available
    if (typeof window !== "undefined" && (window as any).__errorTracker) {
      try {
        (window as any).__errorTracker.captureException(error, {
          extra: {
            componentStack: errorInfo.componentStack,
          },
        });
      } catch (e) {
        // Error tracker failed, ignore
      }
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = "/";
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDevelopment = import.meta.env.DEV;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
          <Card className="w-full max-w-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" aria-hidden="true" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
                  Quelque chose s'est mal passé
                </h1>
                <p className="text-sm sm:text-base text-slate-600 mb-4">
                  Une erreur inattendue s'est produite. Veuillez réessayer ou contacter le support si le problème persiste.
                </p>
                
                {isDevelopment && this.state.error && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs font-mono text-slate-800 break-all mb-2">
                      <strong>Error:</strong> {this.state.error.message}
                    </p>
                    {this.state.errorInfo?.componentStack && (
                      <details className="mt-2">
                        <summary className="text-xs font-semibold text-slate-700 cursor-pointer mb-2">
                          Stack Trace
                        </summary>
                        <pre className="text-xs font-mono text-slate-600 overflow-auto max-h-48 p-2 bg-white rounded border border-slate-200">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                    {this.state.error.stack && (
                      <details className="mt-2">
                        <summary className="text-xs font-semibold text-slate-700 cursor-pointer mb-2">
                          Error Stack
                        </summary>
                        <pre className="text-xs font-mono text-slate-600 overflow-auto max-h-48 p-2 bg-white rounded border border-slate-200">
                          {this.state.error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="flex-1 sm:flex-none"
                aria-label="Réessayer"
              >
                <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                Réessayer
              </Button>
              <Button
                onClick={this.handleReload}
                variant="default"
                className="flex-1 sm:flex-none"
                aria-label="Recharger la page"
              >
                <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                Recharger
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="ghost"
                className="flex-1 sm:flex-none"
                aria-label="Retour à l'accueil"
              >
                <Home className="w-4 h-4 mr-2" aria-hidden="true" />
                Accueil
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

