import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
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

    const nextResults: GenerationResultItem[] = [];

    try {
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        setCurrentIndex(i);
        setStatusText(`Generating ${i + 1} / ${products.length}`);

        const response = await generateTryOn({
          variantId: p.variantGid,
          shop: shopDomain,
          personImage: selectedPersonMode === "file" ? selectedPersonFile : null,
          personImageUrl: selectedPersonMode === "url" ? selectedPersonImageUrl : null,
          customerInfo: customerInfo,
          onStatusUpdate: (s) => setStatusText(s || `Generating ${i + 1} / ${products.length}`),
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
    <div className="h-screen w-screen bg-white">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
        <div className="border-b border-gray-100 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Your Try-On</p>
              <p className="text-xs text-gray-500">
                {products.length > 0 ? `${products.length} products detected on this page` : "Waiting for products…"}
              </p>
            </div>
            <Button
              type="button"
              className="shrink-0 border border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
              onClick={handleRequestContextFromParent}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900">Choose a photo</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                className="bg-gray-900 text-white hover:bg-gray-800"
                onClick={handleTriggerUpload}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </div>

            <div className="mt-3">
              {isLoadingPhotos ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your photos…
                </div>
              ) : uploadedPhotos.length === 0 ? (
                <p className="text-sm text-gray-500">No uploaded photos yet. Upload one to start.</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto py-2">
                  {uploadedPhotos.map((p) => {
                    const isSelected = selectedPersonImageUrl === p.personImageUrl;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-label="Select uploaded photo"
                        onClick={() => handleSelectUploadedPhoto(p.personImageUrl)}
                        className={[
                          "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                          isSelected ? "border-primary" : "border-transparent hover:border-primary/40",
                        ].join(" ")}
                      >
                        <img src={p.personImageUrl} alt="Uploaded" className="h-full w-full object-cover" />
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
              <p className="mt-2 text-xs text-gray-600">Using uploaded file: {selectedPersonFile.name}</p>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900">Generate</p>
              <Button type="button" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  `Generate for ${products.length || 0} products`
                )}
              </Button>
            </div>

            {isGenerating ? (
              <div className="mt-3 text-sm text-gray-600">
                <p>{statusText || "Working…"}</p>
                {currentIndex >= 0 ? (
                  <p className="mt-1 text-xs text-gray-500">
                    Current: {products[currentIndex]?.handle}
                  </p>
                ) : null}
              </div>
            ) : null}

            {results.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-500">Generated</p>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {results.map((r) => (
                    <div key={r.variantId} className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                      <img src={r.generatedImageUrl} alt={r.handle} className="h-24 w-full object-cover" />
                      <div className="px-2 py-1">
                        <p className="truncate text-[11px] font-medium text-gray-700">{r.handle}</p>
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
  );
}

