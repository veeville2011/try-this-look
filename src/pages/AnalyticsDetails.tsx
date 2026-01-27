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
  ChevronRight,
  ShoppingCart,
  Package,
  Link2,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { fetchImageGenerations } from "@/services/imageGenerationsApi";
import type { ImageGenerationRecord } from "@/types/imageGenerations";
import { format } from "date-fns";

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

  // Format date for display (shorter format)
  const formatDateShort = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "MMM dd, yyyy 'at' hh:mm:ss a");
    } catch {
      return dateString;
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

  const hasCartInfo = record.addToCartInfo?.hasCartEvents ?? false;
  const hasOtherProducts = record.otherProductsAddedToCart && record.otherProductsAddedToCart.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <NavigationBar />
      <main className="min-h-[calc(100vh-56px)] py-6" role="main">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header with Breadcrumb and Status */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Person Image */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
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
                          className="h-8 w-8 bg-primary/90 text-primary-foreground hover:bg-primary shadow-md hover:shadow-lg transition-all backdrop-blur-sm"
                          onClick={() => window.open(record.personImageUrl, "_blank")}
                          aria-label="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          className="h-8 w-8 bg-primary/90 text-primary-foreground hover:bg-primary shadow-md hover:shadow-lg transition-all backdrop-blur-sm"
                          onClick={async () => {
                            try {
                              const response = await fetch(record.personImageUrl);
                              const blob = await response.blob();
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement("a");
                              link.href = url;
                              link.download = `person-image-${record.id}.${blob.type.split("/")[1] || "jpg"}`;
                              link.click();
                              URL.revokeObjectURL(url);
                            } catch (err) {
                              toast.error("Failed to download image");
                            }
                          }}
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
                <CardHeader className="pb-3">
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
                          className="h-8 w-8 bg-primary/90 text-primary-foreground hover:bg-primary shadow-md hover:shadow-lg transition-all backdrop-blur-sm"
                          onClick={() => window.open(record.clothingImageUrl, "_blank")}
                          aria-label="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          className="h-8 w-8 bg-primary/90 text-primary-foreground hover:bg-primary shadow-md hover:shadow-lg transition-all backdrop-blur-sm"
                          onClick={async () => {
                            try {
                              const response = await fetch(record.clothingImageUrl);
                              const blob = await response.blob();
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement("a");
                              link.href = url;
                              link.download = `clothing-image-${record.id}.${blob.type.split("/")[1] || "jpg"}`;
                              link.click();
                              URL.revokeObjectURL(url);
                            } catch (err) {
                              toast.error("Failed to download image");
                            }
                          }}
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
                <CardHeader className="pb-3">
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
                          className="h-8 w-8 bg-primary/90 text-primary-foreground hover:bg-primary shadow-md hover:shadow-lg transition-all backdrop-blur-sm"
                          onClick={() => window.open(record.generatedImageUrl, "_blank")}
                          aria-label="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          className="h-8 w-8 bg-primary/90 text-primary-foreground hover:bg-primary shadow-md hover:shadow-lg transition-all backdrop-blur-sm"
                          onClick={async () => {
                            try {
                              const response = await fetch(record.generatedImageUrl);
                              const blob = await response.blob();
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement("a");
                              link.href = url;
                              link.download = `generated-image-${record.id}.${blob.type.split("/")[1] || "jpg"}`;
                              link.click();
                              URL.revokeObjectURL(url);
                            } catch (err) {
                              toast.error("Failed to download image");
                            }
                          }}
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

            {/* Product Information - Prominent Display */}
            {record.productTitle && (
              <Card className="border-border bg-card border-l-4 border-l-primary">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg font-semibold text-foreground">
                          {t("analytics.details.productInfo") || "Product Information"}
                        </CardTitle>
                      </div>
                      <CardDescription className="text-sm text-muted-foreground">
                        {t("analytics.details.productInfoDescription") || "Product details for this generation"}
                      </CardDescription>
                    </div>
                    {record.productUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(record.productUrl, "_blank")}
                        className="flex items-center gap-2"
                      >
                        <Link2 className="w-4 h-4" />
                        {t("analytics.details.viewProduct") || "View Product"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.details.productTitle") || "Product Title"}</p>
                      <p className="text-sm font-semibold text-foreground">{record.productTitle}</p>
                    </div>
                    {record.productId && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.details.productId") || "Product ID"}</p>
                        <p className="text-sm font-mono text-foreground">{record.productId}</p>
                      </div>
                    )}
                    {record.variantId && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.details.variantId") || "Variant ID"}</p>
                        <p className="text-sm font-mono text-foreground">{record.variantId}</p>
                      </div>
                    )}
                    {record.aspectRatio && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.details.aspectRatio") || "Aspect Ratio"}</p>
                        <p className="text-sm font-medium text-foreground">{record.aspectRatio}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Customer & Store Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold text-foreground">
                      {t("analytics.details.userInfo") || "Customer Information"}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const firstName = record.customerFirstName || "";
                    const lastName = record.customerLastName || "";
                    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
                    return fullName ? (
                      <div className="flex items-start gap-3">
                        <User className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.table.customerName") || "Customer Name"}</p>
                          <p className="text-sm font-medium text-foreground">{fullName}</p>
                        </div>
                      </div>
                    ) : null;
                  })()}
                  {record.customerEmail && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.table.customerEmail") || "Customer Email"}</p>
                        <p className="text-sm font-medium text-foreground break-all">{record.customerEmail}</p>
                      </div>
                    </div>
                  )}
                  {record.customerId && (
                    <div className="flex items-start gap-3">
                      <User className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Customer ID</p>
                        <p className="text-sm font-mono text-foreground">{record.customerId}</p>
                      </div>
                    </div>
                  )}
                  {record.storeName && (
                    <div className="flex items-start gap-3">
                      <Store className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.table.storeName") || "Store"}</p>
                        <p className="text-sm font-medium text-foreground">{record.storeName}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Basic Information */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold text-foreground">
                      {t("analytics.details.basicInfo") || "Basic Information"}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.table.id") || "ID"}</p>
                      <p className="text-sm font-mono text-foreground break-all">{record.id}</p>
                    </div>
                  </div>
                  {record.requestId && (
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.table.requestId") || "Request ID"}</p>
                        <p className="text-sm font-mono text-foreground">{record.requestId}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.table.createdAt") || "Created At"}</p>
                      <p className="text-sm font-medium text-foreground">{formatDate(record.createdAt)}</p>
                    </div>
                  </div>
                  {record.updatedAt && (
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.table.updatedAt") || "Updated At"}</p>
                        <p className="text-sm font-medium text-foreground">{formatDate(record.updatedAt)}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Add to Cart Information */}
            {hasCartInfo && record.addToCartInfo && (
              <Card className="border-border bg-card border-l-4 border-l-green-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <CardTitle className="text-lg font-semibold text-foreground">
                        {t("analytics.details.addToCartInfo") || "Add to Cart Information"}
                      </CardTitle>
                    </div>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {t("analytics.details.addedToCart") || "Added to Cart"}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm text-muted-foreground">
                    {t("analytics.details.addToCartInfoDescription") || "Cart events and activity for this product"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.details.totalEvents") || "Total Events"}</p>
                      <p className="text-2xl font-bold text-foreground">{record.addToCartInfo.totalEvents || 0}</p>
                    </div>
                    {record.addToCartInfo.firstEventAt && (
                      <div className="p-4 bg-muted/50 rounded-lg border border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.details.firstEvent") || "First Event"}</p>
                        <p className="text-sm font-medium text-foreground">{formatDateShort(record.addToCartInfo.firstEventAt)}</p>
                      </div>
                    )}
                    {record.addToCartInfo.lastEventAt && (
                      <div className="p-4 bg-muted/50 rounded-lg border border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.details.lastEvent") || "Last Event"}</p>
                        <p className="text-sm font-medium text-foreground">{formatDateShort(record.addToCartInfo.lastEventAt)}</p>
                      </div>
                    )}
                    {record.addToCartInfo.actionTypes && record.addToCartInfo.actionTypes.length > 0 && (
                      <div className="p-4 bg-muted/50 rounded-lg border border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.details.actionTypes") || "Action Types"}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {record.addToCartInfo.actionTypes.map((action, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {action}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cart Events Timeline */}
                  {record.addToCartInfo.events && record.addToCartInfo.events.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        {t("analytics.details.cartEventsTimeline") || "Cart Events Timeline"}
                      </h4>
                      <div className="space-y-2">
                        {record.addToCartInfo.events.map((event, idx) => (
                          <div
                            key={event.cartEventId}
                            className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-semibold text-primary">{idx + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {event.actionType}
                                </Badge>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {event.cartEventId}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatDateShort(event.addedAt)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Other Products Added to Cart - Table View */}
            {hasOtherProducts && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg font-semibold text-foreground">
                      {t("analytics.details.otherProductsAddedToCart") || "Other Products Added to Cart"}
                    </CardTitle>
                    <Badge variant="secondary" className="ml-auto">
                      {record.otherProductsAddedToCart?.length || 0} {record.otherProductsAddedToCart?.length === 1 ? (t("analytics.details.product") || "product") : (t("analytics.details.product") ? t("analytics.details.product") + "s" : "products")}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm text-muted-foreground">
                    {t("analytics.details.otherProductsDescription") || "Additional products added to cart during this session"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="bg-muted/50 font-semibold text-foreground min-w-[200px]">{t("analytics.details.product") || "Product"}</TableHead>
                          <TableHead className="bg-muted/50 font-semibold text-foreground min-w-[120px]">{t("analytics.details.productId") || "Product ID"}</TableHead>
                          <TableHead className="bg-muted/50 font-semibold text-foreground min-w-[120px]">{t("analytics.details.variantId") || "Variant ID"}</TableHead>
                          <TableHead className="bg-muted/50 font-semibold text-foreground text-center min-w-[100px]">{t("analytics.details.events") || "Events"}</TableHead>
                          <TableHead className="bg-muted/50 font-semibold text-foreground min-w-[150px]">{t("analytics.details.firstEvent") || "First Event"}</TableHead>
                          <TableHead className="bg-muted/50 font-semibold text-foreground min-w-[150px]">{t("analytics.details.lastEvent") || "Last Event"}</TableHead>
                          <TableHead className="bg-muted/50 font-semibold text-foreground text-center min-w-[100px]">{t("analytics.details.actions") || "Actions"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {record.otherProductsAddedToCart?.map((product, idx) => (
                          <TableRow key={`${product.productId}-${product.variantId}`} className="border-border hover:bg-muted/30">
                            <TableCell>
                              <div className="flex flex-col">
                                <p className="text-sm font-medium text-foreground mb-1">{product.productTitle}</p>
                                {product.productUrl && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs w-fit"
                                    onClick={() => window.open(product.productUrl, "_blank")}
                                  >
                                    <Link2 className="w-3 h-3 mr-1" />
                                    {t("analytics.details.viewProduct") || "View"}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm font-mono text-muted-foreground">{product.productId}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm font-mono text-muted-foreground">{product.variantId}</p>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="font-semibold">
                                {product.totalEvents}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs text-muted-foreground">{formatDateShort(product.firstEventAt)}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs text-muted-foreground">{formatDateShort(product.lastEventAt)}</p>
                            </TableCell>
                            <TableCell className="text-center">
                              {product.hasCartEvents && (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  {t("analytics.details.added") || "Added"}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Technical Details */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold text-foreground">
                    {t("analytics.details.technicalInfo") || "Technical Information"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {record.processingTime && (
                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.table.processingTime") || "Processing Time"}</p>
                        <p className="text-sm font-medium text-foreground">{record.processingTime} ms</p>
                      </div>
                    </div>
                  )}
                  {record.fileSize && (
                    <div className="flex items-start gap-3">
                      <HardDrive className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.table.fileSize") || "File Size"}</p>
                        <p className="text-sm font-medium text-foreground">{record.fileSize}</p>
                      </div>
                    </div>
                  )}
                  {record.mimeType && (
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">MIME Type</p>
                        <p className="text-sm font-medium text-foreground">{record.mimeType}</p>
                      </div>
                    </div>
                  )}
                  {record.ipAddress && (
                    <div className="flex items-start gap-3">
                      <Globe className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.table.ipAddress") || "IP Address"}</p>
                        <p className="text-sm font-mono text-foreground">{record.ipAddress}</p>
                      </div>
                    </div>
                  )}
                  {record.userAgent && (
                    <div className="flex items-start gap-3 md:col-span-2 lg:col-span-3">
                      <Globe className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.table.userAgent") || "User Agent"}</p>
                        <p className="text-sm font-medium text-foreground break-all">{record.userAgent}</p>
                      </div>
                    </div>
                  )}
                  {record.errorMessage && (
                    <div className="flex items-start gap-3 md:col-span-2 lg:col-span-3">
                      <AlertCircle className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("analytics.table.errorMessage") || "Error Message"}</p>
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
