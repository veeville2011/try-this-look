import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchUploadedImages, generateTryOn } from "@/services/tryonApi";

type CustomerInfo = {
  id?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type LandingProduct = {
  handle: string;
  variantId: string;
  variantGid: string;
};

type LandingContextMessage = {
  type: "NUSENSE_LANDING_CONTEXT";
  shopDomain: string;
  customerInfo: CustomerInfo | null;
  products: LandingProduct[];
};

type UploadedPhoto = {
  id: string;
  personImageUrl: string;
  uploadedAt?: string;
};

type GenerationResultItem = {
  handle: string;
  variantId: string;
  generatedImageUrl: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function LandingTryOn() {
  const { t } = useTranslation();
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [products, setProducts] = useState<LandingProduct[]>([]);

  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

  const [selectedPersonImageUrl, setSelectedPersonImageUrl] = useState<string | null>(null);
  const [selectedPersonFile, setSelectedPersonFile] = useState<File | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [results, setResults] = useState<GenerationResultItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleRequestContextFromParent = useCallback(() => {
    try {
      window.parent?.postMessage({ type: "NUSENSE_LANDING_REQUEST_CONTEXT" }, "*");
    } catch {
      // ignore
    }
  }, []);

  const handleCloseLanding = useCallback(() => {
    try {
      window.parent?.postMessage({ type: "NUSENSE_CLOSE_WIDGET" }, "*");
    } catch {
      // ignore
    }
  }, []);

  const handleCloseKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCloseLanding();
      }
    },
    [handleCloseLanding]
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as LandingContextMessage | null;
      if (!data || typeof data !== "object") return;
      if (data.type !== "NUSENSE_LANDING_CONTEXT") return;

      setShopDomain(data.shopDomain || null);
      setCustomerInfo(data.customerInfo || null);
      setProducts(Array.isArray(data.products) ? data.products : []);
    };

    window.addEventListener("message", handleMessage);
    handleRequestContextFromParent();

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [handleRequestContextFromParent]);

  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  const canLoadPhotos = Boolean(shopDomain && customerInfo?.email);

  const handleLoadUploadedPhotos = useCallback(async () => {
    if (!shopDomain || !customerInfo?.email) return;

    setIsLoadingPhotos(true);
    try {
      const response = await fetchUploadedImages({
        email: customerInfo.email,
        store: shopDomain,
        limit: 10,
        page: 1,
      });

      const normalized: UploadedPhoto[] = (response?.data || [])
        .map((it) => {
          const url = it?.personImageUrl ? String(it.personImageUrl).trim() : "";
          const id = it?.id ? String(it.id) : "";
          if (!id || !url) return null;
          return { id, personImageUrl: url, uploadedAt: it?.uploadedAt };
        })
        .filter(Boolean) as UploadedPhoto[];

      setUploadedPhotos(normalized);
    } catch (error) {
      toast.error("Failed to load your uploaded photos.");
    } finally {
      setIsLoadingPhotos(false);
    }
  }, [customerInfo?.email, shopDomain]);

  useEffect(() => {
    if (!canLoadPhotos) return;
    handleLoadUploadedPhotos();
  }, [canLoadPhotos, handleLoadUploadedPhotos]);

  const selectedPersonMode = useMemo(() => {
    if (selectedPersonFile) return "file";
    if (selectedPersonImageUrl) return "url";
    return "none";
  }, [selectedPersonFile, selectedPersonImageUrl]);

  /** Matches generation scope: first 2 products only. */
  const generateProductCount = useMemo(() => Math.min(products.length, 2), [products.length]);

  const handleSelectUploadedPhoto = useCallback((url: string) => {
    setSelectedPersonImageUrl(url);
    setSelectedPersonFile(null);
  }, []);

  const handleTriggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    setSelectedPersonFile(file);
    setSelectedPersonImageUrl(null);
  }, []);

  const handlePersistResults = useCallback(
    async (items: GenerationResultItem[]) => {
      if (!shopDomain) return;
      if (!customerInfo?.id && !customerInfo?.email) return;
      if (items.length === 0) return;

      const payload = {
        shop: shopDomain,
        customerId: customerInfo.id || null,
        email: customerInfo.email || null,
        items: items.map((it) => ({
          variantId: it.variantId,
          generatedImageUrl: it.generatedImageUrl,
        })),
      };

      try {
        const res = await fetch(`/api/personalized-images`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return;
      } catch {
        // ignore
      }
    },
    [customerInfo?.email, customerInfo?.id, shopDomain]
  );

  const handleNotifyParent = useCallback((items: GenerationResultItem[]) => {
    try {
      window.parent?.postMessage(
        {
          type: "NUSENSE_LANDING_TRYON_RESULTS",
          items,
        },
        "*"
      );
    } catch {
      // ignore
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!shopDomain) {
      toast.error("Missing shop context.");
      return;
    }
    if (!customerInfo?.id && !customerInfo?.email) {
      toast.error("Missing customer context.");
      return;
    }
    if (products.length === 0) {
      toast.error("No products found on this page.");
      return;
    }
    if (selectedPersonMode === "none") {
      toast.error("Select a photo or upload a new one.");
      return;
    }

    setIsGenerating(true);
    setCurrentIndex(-1);
    setStatusText(null);
    setResults([]);

    const productsToGenerate = products.slice(0, 2);
    const nextResults: GenerationResultItem[] = [];

    try {
      for (let i = 0; i < productsToGenerate.length; i++) {
        const p = productsToGenerate[i];
        setCurrentIndex(i);
        setStatusText(`Generating ${i + 1} / ${productsToGenerate.length}`);

        const response = await generateTryOn({
          variantId: p.variantGid,
          shop: shopDomain,
          personImage: selectedPersonMode === "file" ? selectedPersonFile : null,
          personImageUrl: selectedPersonMode === "url" ? selectedPersonImageUrl : null,
          customerInfo: customerInfo,
          onStatusUpdate: (s) => setStatusText(s || `Generating ${i + 1} / ${productsToGenerate.length}`),
        });

        if (response.status !== "success" || !response.image) {
          // Continue carefully: record failure and move on
          continue;
        }

        nextResults.push({
          handle: p.handle,
          variantId: p.variantGid,
          generatedImageUrl: response.image,
        });

        setResults([...nextResults]);
        handleNotifyParent(nextResults);

        // Small pacing delay so we never burst the backend
        // eslint-disable-next-line no-await-in-loop
        await sleep(250);
      }

      await handlePersistResults(nextResults);
      handleNotifyParent(nextResults);

      toast.success("Generation complete.");
    } catch (error) {
      toast.error("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
      setCurrentIndex(-1);
      setStatusText(null);
    }
  }, [
    customerInfo,
    handleNotifyParent,
    handlePersistResults,
    products,
    selectedPersonFile,
    selectedPersonImageUrl,
    selectedPersonMode,
    shopDomain,
  ]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-white font-sans">
      <a
        href="#landing-tryon-main"
        className="sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:m-0 focus:h-auto focus:w-auto focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        {t("virtualTryOnModal.skipToContent")}
      </a>

      <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-white p-2 md:p-0">
        <div className="absolute left-2 right-2 top-2 z-[60] flex flex-shrink-0 animate-in slide-in-from-top items-center justify-between rounded-t-lg border-b border-border/40 bg-gradient-to-r from-white via-white to-primary/3 px-4 py-3 shadow-sm backdrop-blur-sm duration-500 sm:px-5 sm:py-3.5 md:left-0 md:right-0 md:top-0 md:rounded-t-none">
          <div className="group/logo flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-primary/10 opacity-0 blur-sm transition-opacity duration-300 group-hover/logo:opacity-100" />
              <img
                src="/assets/NUSENSE_LOGO.svg"
                alt="NUSENSE"
                className="relative z-10 h-4 w-auto flex-shrink-0 transition-transform duration-300 group-hover/logo:scale-110 sm:h-5"
                aria-label="NUSENSE Logo"
              />
            </div>
            <span
              className="flex items-center text-xs font-medium tracking-normal text-muted-foreground sm:text-sm"
              id="modal-title"
            >
              {t("virtualTryOnModal.title")}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCloseLanding}
            onKeyDown={handleCloseKeyDown}
            className="group/close relative flex h-9 w-9 min-w-9 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-200 ease-in-out hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:h-8 sm:w-8 sm:min-w-8"
            aria-label={t("virtualTryOnModal.closeModal")}
          >
            <div className="absolute inset-0 scale-0 rounded-lg bg-primary/5 transition-transform duration-200 group-hover/close:scale-100" />
            <X className="relative z-10 h-4 w-4 text-muted-foreground transition-all duration-200 group-hover/close:rotate-90 group-hover/close:text-primary" />
          </button>
        </div>

        <div className="relative flex w-full flex-1 flex-col overflow-hidden">
          <div
            id="landing-tryon-main"
            className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto scroll-smooth"
            style={{ paddingTop: "52px", paddingBottom: "48px" }}
            role="main"
            tabIndex={-1}
          >
            <div className="flex w-full items-start justify-center px-3 pb-3 pt-4 sm:px-4 sm:pb-4 sm:pt-5 md:px-6 md:pt-6">
              <div className="flex w-full max-w-[980px] flex-col gap-3 sm:gap-4 md:gap-5">
                <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-white p-4 shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Landing try-on</p>
                    <p className="text-xs text-muted-foreground">
                      {products.length > 0
                        ? `${products.length} on page · try-on for ${generateProductCount} product${generateProductCount === 1 ? "" : "s"}`
                        : "Waiting for products…"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="w-full shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground sm:w-auto"
                    onClick={handleRequestContextFromParent}
                    aria-label="Refresh page product context"
                  >
                    Refresh
                  </Button>
                </div>

                <div className="rounded-xl border border-border/60 bg-white p-4 shadow-md sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-foreground">Choose a photo</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                      aria-hidden
                    />
                    <Button type="button" onClick={handleTriggerUpload} className="w-full sm:w-auto">
                      <Upload className="mr-2 h-4 w-4" aria-hidden />
                      Upload
                    </Button>
                  </div>

                  <div className="mt-3">
                    {isLoadingPhotos ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Loading your photos…
                      </div>
                    ) : uploadedPhotos.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No uploaded photos yet. Upload one to start.
                      </p>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto py-2">
                        {uploadedPhotos.map((p) => {
                          const isSelected = selectedPersonImageUrl === p.personImageUrl;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              aria-label="Select uploaded photo"
                              aria-pressed={isSelected}
                              onClick={() => handleSelectUploadedPhoto(p.personImageUrl)}
                              className={[
                                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                                isSelected ? "border-primary" : "border-transparent hover:border-primary/40",
                              ].join(" ")}
                            >
                              <img src={p.personImageUrl} alt="" className="h-full w-full object-cover" />
                              {isSelected ? (
                                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedPersonFile ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Using uploaded file: {selectedPersonFile.name}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-border/60 bg-white p-4 shadow-md sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-foreground">Generate</p>
                    <Button
                      type="button"
                      onClick={handleGenerate}
                      disabled={isGenerating || products.length === 0}
                      className="w-full sm:w-auto"
                      aria-label={
                        products.length === 0
                          ? "Generate try-on unavailable until products are detected on this page"
                          : undefined
                      }
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          Generating…
                        </>
                      ) : products.length === 0 ? (
                        "Generate"
                      ) : (
                        `Generate for ${generateProductCount} product${generateProductCount === 1 ? "" : "s"}`
                      )}
                    </Button>
                  </div>

                  {isGenerating ? (
                    <div className="mt-3 text-sm text-muted-foreground">
                      <p>{statusText || "Working…"}</p>
                      {currentIndex >= 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground/80">
                          Current: {products[currentIndex]?.handle}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {results.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-muted-foreground">Generated</p>
                      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {results.map((r) => (
                          <div
                            key={r.variantId}
                            className="overflow-hidden rounded-lg border border-border/60 bg-muted/20"
                          >
                            <img
                              src={r.generatedImageUrl}
                              alt={r.handle}
                              className="h-24 w-full object-cover"
                            />
                            <div className="px-2 py-1">
                              <p className="truncate text-[11px] font-medium text-foreground">{r.handle}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-2 left-2 right-2 z-10 flex flex-shrink-0 animate-in slide-in-from-bottom rounded-b-lg border-t border-border/40 bg-gradient-to-r from-white via-white to-primary/3 px-4 py-2.5 shadow-sm backdrop-blur-sm duration-500 sm:px-6 sm:py-3 md:bottom-0 md:left-0 md:right-0 md:rounded-b-none">
            <div className="mx-auto max-w-[980px] w-full">
              <p className="text-center text-xs font-medium tracking-normal text-muted-foreground sm:text-sm">
                © {new Date().getFullYear()}{" "}
                <span className="font-bold">
                  <span style={{ color: "#ce0003" }}>NU</span>
                  <span style={{ color: "#564646" }}>SENSE</span>
                </span>
                . {t("virtualTryOnModal.authGate.allRightsReserved")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

