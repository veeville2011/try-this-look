import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useLocation } from "react-router-dom";
import { useShop } from "@/providers/AppBridgeProvider";
import NavigationBar from "@/components/NavigationBar";
import { 
  ExternalLink,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  Calendar,
  User,
  Mail,
  Store,
  FileText,
  Globe,
  HardDrive,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { fetchImageGenerations } from "@/services/imageGenerationsApi";
import type { ImageGenerationRecord } from "@/types/imageGenerations";

const AnalyticsDetails = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const shop = useShop();
  const [record, setRecord] = useState<ImageGenerationRecord | null>(
    location.state?.record || null
  );
  const [loading, setLoading] = useState(!record);
  const [error, setError] = useState<string | null>(null);

  // Normalize shop domain - same way as Analytics page
  const normalizeShopDomain = (shop: string): string => {
    if (shop.includes(".myshopify.com")) {
      return shop.toLowerCase();
    }
    return `${shop.toLowerCase()}.myshopify.com`;
  };

  const shopDomain = shop ? normalizeShopDomain(shop) : "";

  // Format date based on locale with 12-hour format and France timezone
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return dateString;
    }
  };

  // Download image with CORS handling
  const handleDownloadImage = async (imageUrl: string, filename: string) => {
    try {
      // Strategy 1: Try fetch with blob (works if CORS allows)
      try {
        const response = await fetch(imageUrl, {
          method: 'GET',
          mode: 'cors',
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success(t("analytics.imageDownloaded") || "Image downloaded successfully");
          return;
        }
      } catch (fetchError) {
        console.log("Fetch failed, trying canvas approach:", fetchError);
      }

      // Strategy 2: Try canvas approach (works if image allows crossOrigin)
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              canvas.toBlob((blob) => {
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  const downloadLink = document.createElement("a");
                  downloadLink.href = url;
                  downloadLink.download = filename;
                  downloadLink.style.display = "none";
                  document.body.appendChild(downloadLink);
                  downloadLink.click();
                  document.body.removeChild(downloadLink);
                  URL.revokeObjectURL(url);
                  toast.success(t("analytics.imageDownloaded") || "Image downloaded successfully");
                  resolve();
                } else {
                  reject(new Error("Failed to create blob from canvas"));
                }
              }, "image/png");
            } else {
              reject(new Error("Failed to get canvas context"));
            }
          } catch (canvasError) {
            reject(canvasError);
          }
        };
        
        img.onerror = (error) => {
          reject(new Error("Image failed to load with CORS"));
        };
        
        img.src = imageUrl;
      });
    } catch (err) {
      console.error("All download methods failed:", err);
      
      // Strategy 3: Force download using iframe (last resort)
      try {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = imageUrl;
        document.body.appendChild(iframe);
        
        // Try to trigger download after iframe loads
        setTimeout(() => {
          try {
            const link = document.createElement("a");
            link.href = imageUrl;
            link.download = filename;
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            document.body.removeChild(iframe);
            toast.success(t("analytics.imageDownloaded") || "Image downloaded successfully");
          } catch (iframeError) {
            document.body.removeChild(iframe);
            // Final fallback: create download link without target
            const link = document.createElement("a");
            link.href = imageUrl;
            link.download = filename;
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.info(t("analytics.imageDownloadAttempt") || "Download initiated. If it doesn't work, the image may need to be saved manually.");
          }
        }, 100);
      } catch (finalError) {
        console.error("Final download attempt failed:", finalError);
        toast.error(t("analytics.imageDownloadError") || "Failed to download image. Please try right-clicking and saving the image.");
      }
    }
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800 hover:bg-green-200 dark:hover:bg-green-800 transition-colors cursor-default">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {t("analytics.filters.statusCompleted") || "Completed"}
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-800 transition-colors cursor-default">
            <XCircle className="w-3 h-3 mr-1" />
            {t("analytics.filters.statusFailed") || "Failed"}
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors cursor-default">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            {t("analytics.filters.statusProcessing") || "Processing"}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors cursor-default">
            <Clock className="w-3 h-3 mr-1" />
            {t("analytics.filters.statusPending") || "Pending"}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="hover:bg-accent hover:text-accent-foreground transition-colors cursor-default">
            {status}
          </Badge>
        );
    }
  };

  // Fetch record by ID if not passed via state
  useEffect(() => {
    const fetchRecord = async () => {
      if (record || !id) return;

      if (!shopDomain) {
        setError("Store information not available");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch all records and find the one with matching ID
        const params: any = {
          page: 1,
          limit: 1000,
          orderBy: "created_at",
          orderDirection: "DESC",
          storeName: shopDomain,
        };

        const response = await fetchImageGenerations(params);
        
        if (response.status === "success" && response.data) {
          const foundRecord = response.data.records.find((r) => r.id === id);
          if (foundRecord) {
            setRecord(foundRecord);
          } else {
            setError("Record not found");
            toast.error("Record not found");
          }
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load record";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [id, record, shopDomain]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationBar />
        <main className="min-h-[calc(100vh-56px)] py-6" role="main">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <Card className="border-border bg-card">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationBar />
        <main className="min-h-[calc(100vh-56px)] py-6" role="main">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <Card className="border-border bg-card">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {error || "Record not found"}
                  </h3>
                  <Link
                    to="/analytics"
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all rounded-md text-sm font-medium"
                  >
                    {t("analytics.title") || "Analytics"}
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationBar />
      <main className="min-h-[calc(100vh-56px)] py-6" role="main">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Header with Breadcrumb and Status */}
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Link
                  to="/analytics"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("analytics.title") || "Analytics"}
                </Link>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {t("analytics.table.viewDetails") || "View Details"}
                </span>
              </div>
              <div>
                {getStatusBadge(record.status)}
              </div>
            </div>

            {/* Images Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Person Image */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-foreground">
                    {t("analytics.table.personImage") || "Person Image"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {record.personImageUrl ? (
                    <div className="relative group">
                      <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden border border-border">
                        <img
                          src={record.personImageUrl}
                          alt={t("analytics.table.personImage") || "Person Image"}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="absolute top-2 right-2 flex gap-2">
                        <Button
                          size="icon"
                          className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                          onClick={() => window.open(record.personImageUrl, "_blank")}
                          aria-label="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                          onClick={() => handleDownloadImage(record.personImageUrl, `person-image-${record.id}.png`)}
                          aria-label="Download image"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 bg-muted rounded-lg border border-border">
                      <ImageIcon className="w-12 h-12 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">No image</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Clothing Image */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-foreground">
                    {t("analytics.table.clothingImage") || "Clothing Image"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {record.clothingImageUrl ? (
                    <div className="relative group">
                      <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden border border-border">
                        <img
                          src={record.clothingImageUrl}
                          alt={t("analytics.table.clothingImage") || "Clothing Image"}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="absolute top-2 right-2 flex gap-2">
                        <Button
                          size="icon"
                          className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                          onClick={() => window.open(record.clothingImageUrl, "_blank")}
                          aria-label="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                          onClick={() => handleDownloadImage(record.clothingImageUrl, `clothing-image-${record.id}.png`)}
                          aria-label="Download image"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 bg-muted rounded-lg border border-border">
                      <ImageIcon className="w-12 h-12 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">No image</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Generated Image */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-foreground">
                    {t("analytics.table.generatedImage") || "Generated Image"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {record.generatedImageUrl ? (
                    <div className="relative group">
                      <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden border border-border">
                        <img
                          src={record.generatedImageUrl}
                          alt={t("analytics.table.generatedImage") || "Generated Image"}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="absolute top-2 right-2 flex gap-2">
                        <Button
                          size="icon"
                          className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                          onClick={() => window.open(record.generatedImageUrl, "_blank")}
                          aria-label="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                          onClick={() => handleDownloadImage(record.generatedImageUrl, `generated-image-${record.id}.png`)}
                          aria-label="Download image"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 bg-muted rounded-lg border border-border">
                      <ImageIcon className="w-12 h-12 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">No image</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Basic Information */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-foreground">
                    {t("analytics.details.basicInfo") || "Basic Information"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">{t("analytics.table.id") || "ID"}</p>
                      <p className="text-sm font-medium text-foreground">{record.id}</p>
                    </div>
                  </div>
                  {record.requestId && (
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">{t("analytics.table.requestId") || "Request ID"}</p>
                        <p className="text-sm font-medium text-foreground">{record.requestId}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">{t("analytics.table.createdAt") || "Created At"}</p>
                      <p className="text-sm font-medium text-foreground">{formatDate(record.createdAt)}</p>
                    </div>
                  </div>
                  {record.updatedAt && (
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">{t("analytics.table.updatedAt") || "Updated At"}</p>
                        <p className="text-sm font-medium text-foreground">{formatDate(record.updatedAt)}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* User Information */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-foreground">
                    {t("analytics.details.userInfo") || "User Information"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {record.name && (
                    <div className="flex items-start gap-3">
                      <User className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">{t("analytics.table.name") || "Name"}</p>
                        <p className="text-sm font-medium text-foreground">{record.name}</p>
                      </div>
                    </div>
                  )}
                  {record.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">{t("analytics.table.email") || "Email"}</p>
                        <p className="text-sm font-medium text-foreground">{record.email}</p>
                      </div>
                    </div>
                  )}
                  {record.storeName && (
                    <div className="flex items-start gap-3">
                      <Store className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">{t("analytics.table.storeName") || "Store"}</p>
                        <p className="text-sm font-medium text-foreground">{record.storeName}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Technical Details */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-foreground">
                  {t("analytics.details.technicalInfo") || "Technical Information"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {record.processingTime && (
                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">{t("analytics.table.processingTime") || "Processing Time"}</p>
                        <p className="text-sm font-medium text-foreground">{record.processingTime}</p>
                      </div>
                    </div>
                  )}
                  {record.fileSize && (
                    <div className="flex items-start gap-3">
                      <HardDrive className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">{t("analytics.table.fileSize") || "File Size"}</p>
                        <p className="text-sm font-medium text-foreground">{record.fileSize}</p>
                      </div>
                    </div>
                  )}
                  {record.mimeType && (
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">MIME Type</p>
                        <p className="text-sm font-medium text-foreground">{record.mimeType}</p>
                      </div>
                    </div>
                  )}
                  {record.userAgent && (
                    <div className="flex items-start gap-3 md:col-span-2 lg:col-span-3">
                      <Globe className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">{t("analytics.table.userAgent") || "User Agent"}</p>
                        <p className="text-sm font-medium text-foreground break-all">{record.userAgent}</p>
                      </div>
                    </div>
                  )}
                  {record.errorMessage && (
                    <div className="flex items-start gap-3 md:col-span-2 lg:col-span-3">
                      <AlertCircle className="w-4 h-4 mt-0.5 text-destructive" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">{t("analytics.table.errorMessage") || "Error Message"}</p>
                        <p className="text-sm font-medium text-destructive break-all">{record.errorMessage}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AnalyticsDetails;

