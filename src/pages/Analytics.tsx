import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useShop } from "@/providers/AppBridgeProvider";
import NavigationBar from "@/components/NavigationBar";
import { 
  BarChart3, 
  RefreshCw, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Image as ImageIcon,
  ExternalLink
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { fetchImageGenerations } from "@/services/imageGenerationsApi";
import type { ImageGenerationRecord } from "@/types/imageGenerations";

const Analytics = () => {
  const { t } = useTranslation();
  const shop = useShop();

  // State
  const [records, setRecords] = useState<ImageGenerationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  // Image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");

  // Normalize shop domain - same way as billingApi
  const normalizeShopDomain = (shop: string): string => {
    if (shop.includes(".myshopify.com")) {
      return shop.toLowerCase();
    }
    return `${shop.toLowerCase()}.myshopify.com`;
  };

  const shopDomain = shop ? normalizeShopDomain(shop) : "";

  // Fetch data
  const fetchData = async () => {
    if (!shopDomain) {
      setError("Store information not available");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params: any = {
        page,
        limit,
        orderBy: "created_at",
        orderDirection: "DESC",
        storeName: shopDomain, // Always send current store name
      };

      const response = await fetchImageGenerations(params);
      
      if (response.status === "success" && response.data) {
        setRecords(response.data.records);
        setTotal(response.data.pagination.total);
        setTotalPages(response.data.pagination.totalPages);
        setHasNext(response.data.pagination.hasNext);
        setHasPrev(response.data.pagination.hasPrev);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t("analytics.errorMessage") || "Failed to load analytics data";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shopDomain) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, shopDomain]);

  // Pagination handlers
  const handlePreviousPage = () => {
    if (hasPrev) {
      setPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (hasNext) {
      setPage((prev) => prev + 1);
    }
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {t("analytics.filters.statusCompleted") || "Completed"}
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            {t("analytics.filters.statusFailed") || "Failed"}
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            {t("analytics.filters.statusProcessing") || "Processing"}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            {t("analytics.filters.statusPending") || "Pending"}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Calculate stats
  const stats = {
    total,
    completed: records.filter((r) => r.status === "completed").length,
    failed: records.filter((r) => r.status === "failed").length,
    processing: records.filter((r) => r.status === "processing").length,
    pending: records.filter((r) => r.status === "pending").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationBar />
      <main className="min-h-[calc(100vh-56px)] py-6" role="main">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-primary/20">
                  <BarChart3 className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">
                    {t("analytics.title") || "Analytics"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {t("analytics.description") || "View and analyze all image generations"}
                  </p>
                </div>
              </div>

              <Button
                onClick={fetchData}
                disabled={loading || !shopDomain}
                size="icon"
                variant="outline"
                className="h-9 w-9"
                aria-label={t("analytics.refresh") || "Refresh"}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("analytics.stats.total") || "Total Generations"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("analytics.stats.completed") || "Completed"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("analytics.stats.failed") || "Failed"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.processing}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("analytics.stats.processing") || "Processing"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("analytics.stats.pending") || "Pending"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Error Display */}
            {error && (
              <Card className="mb-6 p-4 border-destructive/50 bg-destructive/10">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </Card>
            )}

            {/* Table */}
            {loading && records.length === 0 ? (
              <Card className="border-border">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                        <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                        <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                        <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                        <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                        <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : records.length > 0 ? (
              <Card className="border-border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">{t("analytics.table.status") || "Status"}</TableHead>
                        <TableHead className="min-w-[120px]">{t("analytics.table.personImage") || "Person Image"}</TableHead>
                        <TableHead className="min-w-[120px]">{t("analytics.table.clothingImage") || "Clothing Image"}</TableHead>
                        <TableHead className="min-w-[120px]">{t("analytics.table.generatedImage") || "Generated Image"}</TableHead>
                        <TableHead className="min-w-[150px]">{t("analytics.table.createdAt") || "Created At"}</TableHead>
                        <TableHead className="min-w-[120px]">{t("analytics.table.ipAddress") || "IP Address"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record) => (
                        <TableRow key={record.id} className="hover:bg-muted/50">
                          <TableCell>
                            {getStatusBadge(record.status)}
                          </TableCell>
                          <TableCell>
                            {record.personImageUrl ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8"
                                onClick={() => {
                                  setPreviewImage(record.personImageUrl);
                                  setPreviewTitle(t("analytics.table.personImage") || "Person Image");
                                }}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                {t("analytics.table.viewImage") || "View"}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.clothingImageUrl ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8"
                                onClick={() => {
                                  setPreviewImage(record.clothingImageUrl);
                                  setPreviewTitle(t("analytics.table.clothingImage") || "Clothing Image");
                                }}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                {t("analytics.table.viewImage") || "View"}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.generatedImageUrl ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8"
                                onClick={() => {
                                  setPreviewImage(record.generatedImageUrl);
                                  setPreviewTitle(t("analytics.table.generatedImage") || "Generated Image");
                                }}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                {t("analytics.table.viewImage") || "View"}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(record.createdAt)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {record.ipAddress || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            ) : (
              <Card className="border-border">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {t("analytics.noData") || "No data available"}
                  </h3>
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    {t("analytics.noDataDescription") || "No image generations found for this store."}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Pagination */}
            {records.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                <div className="text-sm text-muted-foreground">
                  {t("analytics.pagination.showing") || "Showing"} {(page - 1) * limit + 1} {t("analytics.pagination.to") || "to"} {Math.min(page * limit, total)} {t("analytics.pagination.ofTotal") || "of"} {total} {t("analytics.pagination.results") || "results"}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={!hasPrev || loading}
                    className="h-9"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    {t("analytics.pagination.previous") || "Previous"}
                  </Button>
                  <div className="text-sm text-muted-foreground px-3">
                    {t("analytics.pagination.page") || "Page"} {page} {t("analytics.pagination.of") || "of"} {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={!hasNext || loading}
                    className="h-9"
                  >
                    {t("analytics.pagination.next") || "Next"}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
            <DialogDescription>
              {t("analytics.table.viewDetails") || "View Details"}
            </DialogDescription>
          </DialogHeader>
          {previewImage && (
            <div className="relative w-full h-[60vh] bg-muted rounded-lg overflow-hidden">
              <img
                src={previewImage}
                alt={previewTitle}
                className="w-full h-full object-contain"
              />
              <Button
                variant="outline"
                size="sm"
                className="absolute top-4 right-4"
                onClick={() => window.open(previewImage, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in New Tab
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Analytics;
