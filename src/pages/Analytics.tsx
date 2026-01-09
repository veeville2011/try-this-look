import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
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
  Maximize2,
  Eye,
  Download
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { fetchImageGenerations } from "@/services/imageGenerationsApi";
import type { ImageGenerationRecord } from "@/types/imageGenerations";
import ExcelJS from "exceljs";

const Analytics = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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

  // Format date for table display in 3 lines (date, conjunction, time)
  const formatDateForTable = (dateString: string) => {
    try {
      const date = new Date(dateString);
      
      // Format date part (e.g., "6 janvier 2026")
      const datePart = date.toLocaleDateString("fr-FR", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      
      // Format time part (e.g., "07:57:08 AM")
      const timePart = date.toLocaleTimeString("fr-FR", {
        timeZone: "Europe/Paris",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      
      // Conjunction in French
      const conjunction = "à";
      
      return {
        date: datePart,
        conjunction,
        time: timePart,
      };
    } catch {
      return {
        date: dateString,
        conjunction: "",
        time: "",
      };
    }
  };


  // Get status color for Excel cells (ARGB format)
  const getStatusColor = (status: string): string => {
    switch (status) {
      case "completed":
        return "FFD1F2D1"; // Light green
      case "failed":
        return "FFFFE1E1"; // Light red
      case "processing":
        return "FFE1F2FF"; // Light blue
      case "pending":
        return "FFFFF8E1"; // Light yellow
      default:
        return "FFFFFFFF"; // White
    }
  };

  // Helper function to detect image extension from URL or Content-Type
  // ExcelJS supports: 'jpeg' | 'png' | 'gif'
  const getImageExtension = (url: string, contentType?: string): 'jpeg' | 'png' | 'gif' => {
    // Try to get extension from Content-Type header first
    if (contentType) {
      if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpeg';
      if (contentType.includes('png')) return 'png';
      if (contentType.includes('gif')) return 'gif';
      // WebP not supported by ExcelJS, convert to png
      if (contentType.includes('webp')) return 'png';
    }
    
    // Fallback to URL extension
    const urlLower = url.toLowerCase();
    if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return 'jpeg';
    if (urlLower.includes('.png')) return 'png';
    if (urlLower.includes('.gif')) return 'gif';
    // WebP not supported by ExcelJS, convert to png
    if (urlLower.includes('.webp')) return 'png';
    
    // Default to png if unknown
    return 'png';
  };

  // Helper function to convert ArrayBuffer to Buffer (for ExcelJS compatibility)
  const arrayBufferToBuffer = (arrayBuffer: ArrayBuffer): Buffer => {
    // Check if Buffer is available (Node.js environment)
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(arrayBuffer);
    }
    // In browser, create a Buffer-like object from Uint8Array
    // ExcelJS accepts Buffer or ArrayBuffer in browser environments
    // We'll use ArrayBuffer directly as ExcelJS supports it
    return arrayBuffer as any as Buffer;
  };

  // Helper function to fetch image as buffer with format detection
  const fetchImageAsBuffer = async (url: string): Promise<{ buffer: Buffer; extension: 'jpeg' | 'png' | 'gif' } | null> => {
    if (!url) return null;
    
    try {
      // Try CORS-enabled fetch first, fallback to regular fetch
      let response: Response;
      try {
        response = await fetch(url, {
          mode: "cors",
          credentials: "omit",
        });
      } catch (corsError) {
        // Fallback to regular fetch if CORS fails
        response = await fetch(url);
      }
      
      if (!response.ok) return null;
      
      const contentType = response.headers.get('content-type') || undefined;
      const arrayBuffer = await response.arrayBuffer();
      const extension = getImageExtension(url, contentType);
      
      // Convert to Buffer for ExcelJS compatibility
      const buffer = arrayBufferToBuffer(arrayBuffer);
      
      return { buffer, extension };
    } catch (error) {
      console.error(`Failed to fetch image from ${url}:`, error);
      return null;
    }
  };

  // Export to Excel with professional formatting and embedded images
  const handleExport = async () => {
    const loadingToast = toast.loading(t("analytics.export.exporting") || "Exporting data...");
    
    try {
      const allData = await fetchAllRecords();
      
      if (allData.length === 0) {
        toast.dismiss(loadingToast);
        toast.error(t("analytics.export.noData") || "No data to export");
        return;
      }

      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Analytics");

      // Define headers
      const headers = [
        "ID",
        "Status",
        "Person Image",
        "Clothing Image",
        "Generated Image",
        "Created At",
      ];

      // Set column widths - wider for image columns
      worksheet.columns = [
        { width: 30 }, // ID
        { width: 15 }, // Status
        { width: 25 }, // Person Image (will show preview)
        { width: 25 }, // Clothing Image (will show preview)
        { width: 25 }, // Generated Image (will show preview)
        { width: 30 }, // Created At
      ];

      // Style header row
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFC96442" }, // Primary color
      };
      headerRow.alignment = { 
        horizontal: "center", 
        vertical: "middle", 
        wrapText: true 
      };
      headerRow.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
      headerRow.height = 25;

      // Set row height for image rows (taller to accommodate images)
      const imageRowHeight = 120;

      // Add data rows with images
      for (let i = 0; i < allData.length; i++) {
        const record = allData[i];
        const rowIndex = i + 2; // +2 because row 1 is header, rows start at 2
        
        // Add row with data (images will be added separately)
        const row = worksheet.addRow([
          record.id || "",
          record.status || "",
          "", // Person Image - will be replaced with image
          "", // Clothing Image - will be replaced with image
          "", // Generated Image - will be replaced with image
          formatDate(record.createdAt),
        ]);

        // Set row height for images
        row.height = imageRowHeight;

        // Apply base styling to all cells in the row
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E5E5" } },
            bottom: { style: "thin", color: { argb: "FFE5E5E5" } },
            left: { style: "thin", color: { argb: "FFE5E5E5" } },
            right: { style: "thin", color: { argb: "FFE5E5E5" } },
          };
          cell.alignment = { 
            vertical: "middle", 
            wrapText: true 
          };

          // Style status column (column 2)
          if (colNumber === 2 && record.status) {
            const statusColor = getStatusColor(record.status);
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: statusColor },
            };
            cell.font = { bold: true };
            cell.alignment = { 
              horizontal: "center", 
              vertical: "middle", 
              wrapText: true 
            };
          }

          // Center align ID column (column 1)
          if (colNumber === 1) {
            cell.alignment = { 
              horizontal: "center", 
              vertical: "middle", 
              wrapText: true 
            };
          }

          // Center align image columns (columns 3-5)
          if (colNumber >= 3 && colNumber <= 5) {
            cell.alignment = { 
              horizontal: "center", 
              vertical: "middle", 
              wrapText: true 
            };
          }
        });

        // Fetch and add images
        const imageSize = 100; // Size in pixels for Excel images
        
        // Person Image (column C = 3)
        if (record.personImageUrl) {
          const imageData = await fetchImageAsBuffer(record.personImageUrl);
          if (imageData) {
            const imageId = workbook.addImage({
              buffer: imageData.buffer as any, // Type assertion for browser compatibility
              extension: imageData.extension,
            });
            
            worksheet.addImage(imageId, {
              tl: { col: 2, row: rowIndex - 1 }, // Column C (0-indexed: 2), row (0-indexed)
              ext: { width: imageSize, height: imageSize },
            });
          }
        }

        // Clothing Image (column D = 4)
        if (record.clothingImageUrl) {
          const imageData = await fetchImageAsBuffer(record.clothingImageUrl);
          if (imageData) {
            const imageId = workbook.addImage({
              buffer: imageData.buffer as any, // Type assertion for browser compatibility
              extension: imageData.extension,
            });
            
            worksheet.addImage(imageId, {
              tl: { col: 3, row: rowIndex - 1 }, // Column D (0-indexed: 3)
              ext: { width: imageSize, height: imageSize },
            });
          }
        }

        // Generated Image (column E = 5)
        if (record.generatedImageUrl) {
          const imageData = await fetchImageAsBuffer(record.generatedImageUrl);
          if (imageData) {
            const imageId = workbook.addImage({
              buffer: imageData.buffer as any, // Type assertion for browser compatibility
              extension: imageData.extension,
            });
            
            worksheet.addImage(imageId, {
              tl: { col: 4, row: rowIndex - 1 }, // Column E (0-indexed: 4)
              ext: { width: imageSize, height: imageSize },
            });
          }
        }

        // Update progress for large exports
        if ((i + 1) % 10 === 0) {
          toast.loading(
            `${t("analytics.export.exporting") || "Exporting data..."} (${i + 1}/${allData.length})`,
            { id: loadingToast }
          );
        }
      }

      // Freeze header row
      worksheet.views = [{ state: "frozen", ySplit: 1 }];

      // Generate Excel file buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Create blob and download
      const blob = new Blob([buffer], { 
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `analytics-export-${new Date().toISOString().split("T")[0]}.xlsx`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success(t("analytics.export.success") || "Data exported successfully");
    } catch (err) {
      console.error("Export error:", err);
      toast.dismiss(loadingToast);
      toast.error(t("analytics.export.error") || "Failed to export data");
    }
  };

  // Handle view details
  const handleViewDetails = (record: ImageGenerationRecord) => {
    navigate(`/analytics/${record.id}`, { state: { record } });
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
                        <TableHead className="min-w-[180px] bg-muted/50 font-semibold text-foreground text-center">{t("analytics.table.createdAt") || "Created At"}</TableHead>
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
                                    onClick={() => window.open(record.personImageUrl, "_blank")}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        window.open(record.personImageUrl, "_blank");
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
                                    onClick={() => window.open(record.clothingImageUrl, "_blank")}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        window.open(record.clothingImageUrl, "_blank");
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
                                    onClick={() => window.open(record.generatedImageUrl, "_blank")}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        window.open(record.generatedImageUrl, "_blank");
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
                          <TableCell className="text-sm text-muted-foreground text-center">
                            {(() => {
                              const dateParts = formatDateForTable(record.createdAt);
                              return (
                                <div className="flex flex-col leading-tight items-center">
                                  <span>{dateParts.date}</span>
                                  <span>{dateParts.conjunction}</span>
                                  <span>{dateParts.time}</span>
                                </div>
                              );
                            })()}
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

    </div>
  );
};

export default Analytics;
