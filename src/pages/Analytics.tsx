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
  Download,
  ExternalLink,
  X
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [imageModal, setImageModal] = useState<{ isOpen: boolean; imageUrl: string | null; imageTitle: string }>({
    isOpen: false,
    imageUrl: null,
    imageTitle: "",
  });


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

  // Export to Excel with professional formatting
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
        "Person Image URL",
        "Clothing Image URL",
        "Generated Image URL",
        "Created At",
      ];

      // Set column widths
      worksheet.columns = [
        { width: 30 }, // ID
        { width: 15 }, // Status
        { width: 50 }, // Person Image URL
        { width: 50 }, // Clothing Image URL
        { width: 50 }, // Generated Image URL
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

      // Add data rows
      allData.forEach((record) => {
        const row = worksheet.addRow([
          record.id || "",
          record.status || "",
          record.personImageUrl || "",
          record.clothingImageUrl || "",
          record.generatedImageUrl || "",
          formatDate(record.createdAt),
        ]);

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

          // Left align URL columns (columns 3-5)
          if (colNumber >= 3 && colNumber <= 5) {
            cell.alignment = { 
              horizontal: "left", 
              vertical: "middle", 
              wrapText: true 
            };
          }
        });

        row.height = 20;
      });

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

  // Handle image click - open modal
  const handleImageClick = (imageUrl: string, imageTitle: string) => {
    setImageModal({
      isOpen: true,
      imageUrl,
      imageTitle,
    });
  };

  // Handle close modal
  const handleCloseModal = () => {
    setImageModal({
      isOpen: false,
      imageUrl: null,
      imageTitle: "",
    });
  };

  // Handle open in new tab
  const handleOpenInNewTab = () => {
    if (imageModal.imageUrl) {
      window.open(imageModal.imageUrl, "_blank");
    }
  };

  // Handle download image with CORS handling
  const handleDownloadImage = async () => {
    if (!imageModal.imageUrl) return;

    const imageUrl = imageModal.imageUrl;
    const filename = imageModal.imageTitle || "image.png";

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
                                    onClick={() => handleImageClick(record.personImageUrl, t("analytics.table.personImage") || "Person Image")}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        handleImageClick(record.personImageUrl, t("analytics.table.personImage") || "Person Image");
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
                                    onClick={() => handleImageClick(record.clothingImageUrl, t("analytics.table.clothingImage") || "Clothing Image")}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        handleImageClick(record.clothingImageUrl, t("analytics.table.clothingImage") || "Clothing Image");
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
                                    onClick={() => handleImageClick(record.generatedImageUrl, t("analytics.table.generatedImage") || "Generated Image")}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        handleImageClick(record.generatedImageUrl, t("analytics.table.generatedImage") || "Generated Image");
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

      {/* Image Modal */}
      <Dialog open={imageModal.isOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent 
          hideOverlay={true}
          className="fixed inset-0 z-50 w-full h-full max-w-none p-0 bg-background border-0 rounded-none"
          style={{ transform: 'none', left: 0, top: 0 }}
        >
          {/* Manual overlay */}
          <div 
            className="absolute inset-0 bg-black/80 z-0" 
            onClick={handleCloseModal}
            aria-hidden="true"
          />
          
          <div className="relative z-10 flex flex-col h-full w-full bg-background">
            {/* Header with title and close button */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-background">
              <DialogHeader className="flex-1">
                <DialogTitle className="text-xl font-semibold text-foreground">
                  {imageModal.imageTitle}
                </DialogTitle>
              </DialogHeader>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseModal}
                className="h-9 w-9 rounded-full hover:bg-accent"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Image container */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-muted/30 min-h-0 w-full">
              {imageModal.imageUrl && (
                <div className="flex items-center justify-center w-full h-full">
                  <img
                    src={imageModal.imageUrl}
                    alt={imageModal.imageTitle}
                    className="object-contain rounded-lg shadow-lg"
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '100%',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Footer with action buttons */}
            <div className="flex items-center justify-center gap-4 p-4 border-t border-border bg-background">
              <Button
                onClick={handleOpenInNewTab}
                className="h-10 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {t("analytics.modal.openInNewTab") || "Open in New Tab"}
              </Button>
              <Button
                onClick={handleDownloadImage}
                className="h-10 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Download className="w-4 h-4 mr-2" />
                {t("analytics.modal.download") || "Download"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Analytics;
