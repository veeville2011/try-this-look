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
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Image as ImageIcon,
  ExternalLink,
  Maximize2,
  Eye,
  Download
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
  const { t, i18n } = useTranslation();
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
  const [previewRecord, setPreviewRecord] = useState<ImageGenerationRecord | null>(null);

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
        storeName: shopDomain,
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

  // Fetch all records for export (paginates through all pages)
  const fetchAllRecords = async () => {
    if (!shopDomain) return [];

    try {
      const allRecords: ImageGenerationRecord[] = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore) {
        const params: any = {
          page: currentPage,
          limit: 100, // Fetch 100 at a time to avoid memory issues
          orderBy: "created_at",
          orderDirection: "DESC",
          storeName: shopDomain,
        };

        const response = await fetchImageGenerations(params);
        
        if (response.status === "success" && response.data) {
          allRecords.push(...response.data.records);
          hasMore = response.data.pagination.hasNext;
          currentPage++;
        } else {
          hasMore = false;
        }
      }

      return allRecords;
    } catch (err) {
      console.error("Failed to fetch all records:", err);
      return [];
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

  // Format date in long format with French month names, 12-hour format and France timezone
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      
      // Always use French locale for month names
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


  // Export to CSV
  const handleExport = async () => {
    const loadingToast = toast.loading(t("analytics.export.exporting") || "Exporting data...");
    
    try {
      const allData = await fetchAllRecords();
      
      if (allData.length === 0) {
        toast.dismiss(loadingToast);
        toast.error(t("analytics.export.noData") || "No data to export");
        return;
      }

      // Create CSV headers
      const headers = [
        "ID",
        "Status",
        "Person Image URL",
        "Clothing Image URL",
        "Generated Image URL",
        "Created At",
      ];

      // Create CSV rows
      const rows = allData.map((record) => [
        record.id || "",
        record.status || "",
        record.personImageUrl || "",
        record.clothingImageUrl || "",
        record.generatedImageUrl || "",
        formatDate(record.createdAt),
      ]);

      // Combine headers and rows
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `analytics-export-${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success(t("analytics.export.success") || "Data exported successfully");
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error(t("analytics.export.error") || "Failed to export data");
    }
  };

  // Handle view details
  const handleViewDetails = (record: ImageGenerationRecord) => {
    setPreviewRecord(record);
    setPreviewImage(record.generatedImageUrl || record.personImageUrl || record.clothingImageUrl || null);
    setPreviewTitle(t("analytics.table.viewDetails") || "View Details");
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

              <div className="flex items-center gap-2">
                <Button
                  onClick={fetchData}
                  disabled={loading || !shopDomain}
                  className="h-9 border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={t("analytics.refresh") || "Refresh"}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {t("analytics.refresh") || "Refresh"}
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={loading || total === 0}
                  className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t("analytics.export.button") || "Export"}
                </Button>
              </div>
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
              <Card className="border-border bg-card">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="bg-muted/50"><Skeleton className="h-4 w-16" /></TableHead>
                        <TableHead className="bg-muted/50"><Skeleton className="h-4 w-24" /></TableHead>
                        <TableHead className="bg-muted/50"><Skeleton className="h-4 w-32" /></TableHead>
                        <TableHead className="bg-muted/50"><Skeleton className="h-4 w-32" /></TableHead>
                        <TableHead className="bg-muted/50"><Skeleton className="h-4 w-32" /></TableHead>
                        <TableHead className="bg-muted/50"><Skeleton className="h-4 w-32" /></TableHead>
                        <TableHead className="bg-muted/50"><Skeleton className="h-4 w-24" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...Array(5)].map((_, i) => (
                        <TableRow key={i} className="border-border">
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
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
              <Card className="border-border bg-card">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="min-w-[80px] bg-muted/50 font-semibold text-foreground">#</TableHead>
                        <TableHead className="min-w-[100px] bg-muted/50 font-semibold text-foreground">{t("analytics.table.status") || "Status"}</TableHead>
                        <TableHead className="min-w-[120px] bg-muted/50 font-semibold text-foreground">{t("analytics.table.personImage") || "Person Image"}</TableHead>
                        <TableHead className="min-w-[120px] bg-muted/50 font-semibold text-foreground">{t("analytics.table.clothingImage") || "Clothing Image"}</TableHead>
                        <TableHead className="min-w-[120px] bg-muted/50 font-semibold text-foreground">{t("analytics.table.generatedImage") || "Generated Image"}</TableHead>
                        <TableHead className="min-w-[180px] bg-muted/50 font-semibold text-foreground">{t("analytics.table.createdAt") || "Created At"}</TableHead>
                        <TableHead className="min-w-[120px] bg-muted/50 font-semibold text-foreground">{t("analytics.table.actions") || "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record, index) => (
                        <TableRow key={record.id} className="border-border hover:bg-muted/30 transition-colors">
                          <TableCell className="text-sm text-muted-foreground font-medium">
                            {(page - 1) * limit + index + 1}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(record.status)}
                          </TableCell>
                          <TableCell className="align-middle">
                            {record.personImageUrl ? (
                              <div className="flex items-center justify-center">
                                <div className="relative group">
                                  <div
                                    className="cursor-pointer hover:opacity-80 transition-opacity relative"
                                    onClick={() => {
                                      setPreviewImage(record.personImageUrl);
                                      setPreviewTitle(t("analytics.table.personImage") || "Person Image");
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setPreviewImage(record.personImageUrl);
                                        setPreviewTitle(t("analytics.table.personImage") || "Person Image");
                                      }
                                    }}
                                    tabIndex={0}
                                    role="button"
                                    aria-label={t("analytics.table.personImage") || "Person Image"}
                                  >
                                    <img
                                      src={record.personImageUrl}
                                      alt={t("analytics.table.personImage") || "Person Image"}
                                      className="w-20 h-auto object-contain rounded border border-border bg-muted"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                                      <Maximize2 className="w-6 h-6 text-white" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="align-middle">
                            {record.clothingImageUrl ? (
                              <div className="flex items-center justify-center">
                                <div className="relative group">
                                  <div
                                    className="cursor-pointer hover:opacity-80 transition-opacity relative"
                                    onClick={() => {
                                      setPreviewImage(record.clothingImageUrl);
                                      setPreviewTitle(t("analytics.table.clothingImage") || "Clothing Image");
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setPreviewImage(record.clothingImageUrl);
                                        setPreviewTitle(t("analytics.table.clothingImage") || "Clothing Image");
                                      }
                                    }}
                                    tabIndex={0}
                                    role="button"
                                    aria-label={t("analytics.table.clothingImage") || "Clothing Image"}
                                  >
                                    <img
                                      src={record.clothingImageUrl}
                                      alt={t("analytics.table.clothingImage") || "Clothing Image"}
                                      className="w-20 h-auto object-contain rounded border border-border bg-muted"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                                      <Maximize2 className="w-6 h-6 text-white" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="align-middle">
                            {record.generatedImageUrl ? (
                              <div className="flex items-center justify-center">
                                <div className="relative group">
                                  <div
                                    className="cursor-pointer hover:opacity-80 transition-opacity relative"
                                    onClick={() => {
                                      setPreviewImage(record.generatedImageUrl);
                                      setPreviewTitle(t("analytics.table.generatedImage") || "Generated Image");
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setPreviewImage(record.generatedImageUrl);
                                        setPreviewTitle(t("analytics.table.generatedImage") || "Generated Image");
                                      }
                                    }}
                                    tabIndex={0}
                                    role="button"
                                    aria-label={t("analytics.table.generatedImage") || "Generated Image"}
                                  >
                                    <img
                                      src={record.generatedImageUrl}
                                      alt={t("analytics.table.generatedImage") || "Generated Image"}
                                      className="w-20 h-auto object-contain rounded border border-border bg-muted"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                                      <Maximize2 className="w-6 h-6 text-white" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(record.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handleViewDetails(record)}
                              className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              {t("analytics.table.viewDetails") || "View Details"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            ) : (
              <Card className="border-border bg-card">
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
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={!hasPrev || loading}
                    className="h-9 border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    {t("analytics.pagination.previous") || "Previous"}
                  </Button>
                  <div className="text-sm text-muted-foreground px-3">
                    {t("analytics.pagination.page") || "Page"} {page} {t("analytics.pagination.of") || "of"} {totalPages}
                  </div>
                  <Button
                    size="sm"
                    onClick={handleNextPage}
                    disabled={!hasNext || loading}
                    className="h-9 border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                size="sm"
                className="absolute top-4 right-4 border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => window.open(previewImage, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in New Tab
              </Button>
            </div>
          )}
          {previewRecord && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-foreground">{t("analytics.table.status") || "Status"}:</span>
                  <div className="mt-1">{getStatusBadge(previewRecord.status)}</div>
                </div>
                <div>
                  <span className="font-semibold text-foreground">{t("analytics.table.createdAt") || "Created At"}:</span>
                  <p className="mt-1 text-muted-foreground">{formatDate(previewRecord.createdAt)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Analytics;
