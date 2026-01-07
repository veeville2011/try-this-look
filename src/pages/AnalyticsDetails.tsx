import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useShop } from "@/providers/AppBridgeProvider";
import NavigationBar from "@/components/NavigationBar";
import { 
  ArrowLeft,
  ExternalLink,
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
  HardDrive
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { fetchImageGenerations } from "@/services/imageGenerationsApi";
import type { ImageGenerationRecord } from "@/types/imageGenerations";

const AnalyticsDetails = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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

  const handleBack = () => {
    navigate("/analytics");
  };

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
                  <Button
                    onClick={handleBack}
                    className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Analytics
                  </Button>
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
            {/* Header with Back Button */}
            <div className="flex items-center gap-4 mb-6">
              <Button
                onClick={handleBack}
                className="border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("common.back") || "Back"}
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {t("analytics.table.viewDetails") || "View Details"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t("analytics.description") || "View and analyze all image generations"}
                </p>
              </div>
            </div>

            {/* Status Card */}
            <Card className="mb-6 border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">{t("analytics.table.status") || "Status"}:</span>
                  {getStatusBadge(record.status)}
                </div>
              </CardContent>
            </Card>

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
                      <Button
                        size="sm"
                        className="absolute top-2 right-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                        onClick={() => window.open(record.personImageUrl, "_blank")}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open
                      </Button>
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
                      <Button
                        size="sm"
                        className="absolute top-2 right-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                        onClick={() => window.open(record.clothingImageUrl, "_blank")}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open
                      </Button>
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
                      <Button
                        size="sm"
                        className="absolute top-2 right-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                        onClick={() => window.open(record.generatedImageUrl, "_blank")}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open
                      </Button>
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

