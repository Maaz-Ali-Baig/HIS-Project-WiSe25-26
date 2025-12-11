import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../../store/auth";
import { useFileStore } from "../../../store/fileStore";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
import {
  DataTable,
  inferColumnTypeCounts,
  inferColumnSummaries,
} from "../../../components/DataTable";
import {
  uploadFile,
  getFileData,
  updateFileData,
  updateColumnSelection,
} from "../api/uploads";
import { toast } from "sonner";
import { Loader2, AlertCircle, Save, X } from "lucide-react";
import { ColumnSelectionPanel } from "../../../components/ColumnSelectionPanel";

export function HomePage() {
  const navigate = useNavigate();
  const { fileId } = useParams<{ fileId?: string }>();
  const { user, logout } = useAuthStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewMode, setPreviewMode] = useState<"data" | "summary">("data");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    setFile,
    pendingEdits,
    status,
    discardEdits,
    setSaving,
    markSaved,
    updateColumnSelection: updateStoreColumnSelection,
    selectionRanges,
    totalColumns,
  } = useFileStore();

  // This ref will hold the "full file" data for the CURRENT fileId
  // and will NOT be changed by column selection.
  const initialFileDataRef = useRef<any | null>(null);

  // When fileId changes (new file / route), reset the base reference
  useEffect(() => {
    initialFileDataRef.current = null;
  }, [fileId]);

  // Fetch file data when fileId is present
  const {
    data: fileData,
    isLoading: isLoadingData,
    error: dataError,
    refetch: refetchData,
  } = useQuery({
    queryKey: ["fileData", user?.id, fileId],
    queryFn: () =>
      getFileData({
        userId: user!.id,
        fileId: fileId!,
      }),
    enabled: Boolean(user?.id && fileId),
    retry: 1,
  });

  // Capture the "full" dataset once per fileId (first time fileData arrives)
  useEffect(() => {
    if (fileData && !initialFileDataRef.current) {
      initialFileDataRef.current = fileData;
    }
  }, [fileData]);

  // Hydrate file store when data loads (for preview / edits)
  useEffect(() => {
    if (fileData && fileId && user?.id) {
      setFile(
        fileId,
        user.id,
        fileData.columns,
        fileData.rows,
        fileData.updated_at,
        fileData.selectionRanges || [],
        fileData.totalColumns || fileData.columns.length
      );
    }
  }, [fileData, fileId, user?.id, setFile]);

  const uploadMutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: (data) => {
      toast.success("File uploaded successfully!");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      navigate(`/${data.fileId}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upload file");
    },
  });

  const saveMutation = useMutation({
    mutationFn: updateFileData,
    onSuccess: (data) => {
      toast.success("Changes saved successfully!");
      markSaved(data.rows, data.updated_at);
      refetchData();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save changes");
    },
  });

  const columnSelectionMutation = useMutation({
    mutationFn: updateColumnSelection,
    onSuccess: (data) => {
      toast.success("Column selection updated successfully!");
      updateStoreColumnSelection(
        data.columns,
        data.rows,
        data.updated_at,
        data.selectionRanges,
        data.totalColumns
      );
      refetchData();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update column selection");
    },
  });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const lower = file.name.toLowerCase();
      if (
        !lower.endsWith(".csv") &&
        !lower.endsWith(".xls") &&
        !lower.endsWith(".xlsx")
      ) {
        toast.error("Please select a CSV or Excel file (.csv, .xls, .xlsx)");
        event.target.value = "";
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !user?.id) {
      toast.error("Please select a file to upload");
      return;
    }

    uploadMutation.mutate({
      userId: user.id,
      username: user.username,
      file: selectedFile,
    });
  };

  const handleSaveChanges = () => {
    if (!user?.id || !fileId || pendingEdits.size === 0) return;

    setSaving();
    const edits = Array.from(pendingEdits.entries()).map(
      ([rowId, changes]) => ({
        rowId,
        changes,
      })
    );

    saveMutation.mutate({
      userId: user.id,
      fileId,
      edits,
    });
  };

  const handleDiscardChanges = () => {
    discardEdits();
    toast.info("Changes discarded");
  };

  const handleApplyColumnSelection = (
    ranges: Array<{ start: number; end: number }>
  ) => {
    if (!user?.id || !fileId) return;

    if (pendingEdits.size > 0) {
      const confirmed = window.confirm(
        "You have unsaved edits. Changing column selection will discard these edits. Continue?"
      );
      if (!confirmed) return;
      discardEdits();
    }

    columnSelectionMutation.mutate({
      userId: user.id,
      fileId,
      ranges,
    });
  };

  const handleResetColumnSelection = () => {
    if (!user?.id || !fileId) return;

    if (pendingEdits.size > 0) {
      const confirmed = window.confirm(
        "You have unsaved edits. Resetting column selection will discard these edits. Continue?"
      );
      if (!confirmed) return;
      discardEdits();
    }

    columnSelectionMutation.mutate({
      userId: user.id,
      fileId,
      ranges: [], // Empty array means "select all"
    });
  };

  const hasPendingEdits = pendingEdits.size > 0;

  // =========================
  //  FILE DETAILS (FULL FILE)
  // =========================

  // Use the stored "full" dataset if available; fallback to current fileData.
  const baseFileData = initialFileDataRef.current ?? fileData;

  const numColumns = baseFileData?.columns?.length ?? 0;
  const numRows = baseFileData?.rows?.length ?? 0;

  const {
    numeric: numericColumns,
    categorical: categoricalColumns,
    freeText: freeTextColumns,
    other: otherColumns,
  } = useMemo(
    () =>
      baseFileData
        ? inferColumnTypeCounts(
            (baseFileData.columns ?? []) as string[],
            (baseFileData.rows ?? []) as Array<Record<string, string>>
          )
        : { numeric: 0, categorical: 0, freeText: 0, other: 0 },
    [baseFileData]
  );

  const baseColumnSummaries = useMemo(
    () =>
      baseFileData
        ? inferColumnSummaries(
            baseFileData.columns as string[],
            baseFileData.rows as Array<Record<string, string>>
          )
        : [],
    [baseFileData]
  );

  const totalMissingCells = baseColumnSummaries.reduce(
    (sum, col) => sum + col.missing,
    0
  );
  const totalCells = numRows * numColumns;
  const totalMissingPercent =
    totalCells > 0 ? (totalMissingCells / totalCells) * 100 : 0;

  // =========================
  //  PREVIEW / SUMMARY STATS
  // =========================

  const previewNumColumns = fileData?.columns?.length ?? 0;

  const columnSummaries = useMemo(
    () =>
      fileData
        ? inferColumnSummaries(
            fileData.columns as string[],
            fileData.rows as Array<Record<string, string>>
          )
        : [],
    [fileData]
  );

  // badge styling for Type
  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case "Numeric":
        return "bg-blue-100 text-blue-800";
      case "Categorical":
        return "bg-teal-100 text-teal-800";
      case "Free Text":
        return "bg-purple-100 text-purple-800";
      case "Other":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top navigation bar */}
      <header className="w-full bg-gradient-to-r from-blue-800 via-blue-700 to-blue-600 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          {/* Logo + title */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-28 items-center justify-center rounded-2xl bg-white shadow-lg">
              <img
                src="/logo.png"
                alt="Logo"
                className="max-h-12 max-w-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-none">
                Data Pre-Processing Platform
              </h1>
              <p className="mt-1 text-sm text-blue-100">
                for Qualitative Data Analysis
              </p>
            </div>
          </div>

          {/* Navigation items */}
          <nav className="ml-8 flex flex-1 items-center justify-end gap-8">
            <button
              type="button"
              className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-blue-700 shadow-lg"
              onClick={() => navigate("/")}
            >
              Selection and Preview
            </button>
            <button
              type="button"
              className="text-sm font-medium text-blue-100 hover:text-white"
              onClick={() => navigate("/transform")}
            >
              Data Transformation
            </button>
            <button
              type="button"
              className="text-sm font-medium text-blue-100 hover:text-white"
              onClick={() => navigate("/correlation")}
            >
              Correlation Analysis
            </button>
            <button
              type="button"
              className="text-sm font-medium text-blue-100 hover:text-white"
              onClick={() => navigate("/visualization")}
            >
              Visualization
            </button>
            <button
              type="button"
              className="text-sm font-medium text-blue-100 hover:text-white"
              onClick={() => navigate("/report")}
            >
              Report
            </button>
            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              className="rounded-full border-white/80 bg-transparent px-6 py-2 text-sm font-semibold text-white hover:bg-white hover:text-blue-700"
            >
              Logout
            </Button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex justify-center px-4 py-8">
        <div className="w-full max-w-6xl space-y-6">
          {/* Two top panels: Upload File (left) and File Details (right) */}
          <div className="grid items-start gap-6 md:grid-cols-2">
            {/* Left: Upload File */}
            <Card className="h-full min-h-[180px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Upload File</CardTitle>
                <CardDescription className="text-xs">
                  Upload a CSV or Excel file to start working with your data
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-green-400 bg-green-50 px-3 py-4">
                    <Input
                      ref={fileInputRef}
                      id="file-upload"
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={uploadMutation.isPending}
                    />
                    <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full bg-green-500 px-5 py-1.5 text-xs font-semibold text-white hover:bg.green-600"
                      disabled={uploadMutation.isPending}
                    >
                      Choose File
                    </Button>
                    <p className="mt-3 text-center text-xs font-semibold text-green-800">
                      {selectedFile
                        ? `${selectedFile.name} is selected`
                        : fileId
                        ? "File is uploaded ✓"
                        : "No file selected"}
                    </p>
                    <p className="mt-1 text-center text-[11px] text-green-700">
                      Supported formats: CSV, Excel (.xls, .xlsx)
                    </p>
                  </div>

                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || uploadMutation.isPending}
                    className="w-full text-xs"
                  >
                    {uploadMutation.isPending ? "Uploading..." : "Upload File"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Right: File Details summary – based on FULL file, not selection */}
            <Card className="h-full min-h-[180px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">File Details</CardTitle>
                <CardDescription className="text-xs">
                  Summary of the complete dataset
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                {baseFileData ? (
                  <div className="space-y-1.5 text-xs text-gray-800">
                    <p>
                      <span className="font-semibold">No. of Columns: </span>
                      {numColumns}
                    </p>
                    <p>
                      <span className="font-semibold">No. of Rows: </span>
                      {numRows}
                    </p>
                    <p>
                      <span className="font-semibold">Numerical Columns: </span>
                      {numericColumns}
                    </p>
                    <p>
                      <span className="font-semibold">
                        Categorical Columns:{" "}
                      </span>
                      {categoricalColumns}
                    </p>
                    <p>
                      <span className="font-semibold">Free Text Columns: </span>
                      {freeTextColumns}
                    </p>
                    <p>
                      <span className="font-semibold">Other Columns: </span>
                      {otherColumns}
                    </p>
                    <p>
                      <span className="font-semibold">
                        Missing Values (% of all cells):{" "}
                      </span>
                      {totalMissingPercent.toFixed(2)}%
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    No file loaded yet. Upload a file on the left to see its
                    summary here.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Column Selection Panel - shown when fileId is present */}
          {fileId && fileData && totalColumns > 0 && (
            <ColumnSelectionPanel
              totalColumns={totalColumns}
              currentRanges={selectionRanges}
              onApply={handleApplyColumnSelection}
              onReset={handleResetColumnSelection}
              isLoading={columnSelectionMutation.isPending}
            />
          )}

          {/* File Preview Card - shown when fileId is present */}
          {fileId && (
            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>File Preview</CardTitle>
                  <CardDescription>
                    {fileData
                      ? previewMode === "data"
                        ? `Displaying ${fileData.rows.length} rows and ${fileData.columns.length} columns`
                        : `Showing ${columnSummaries.length} of ${previewNumColumns} columns`
                      : "Loading file data..."}
                  </CardDescription>
                </div>
                <div className="inline-flex rounded-full bg-muted p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={previewMode === "data" ? "default" : "ghost"}
                    className="rounded-full px-4 text-xs md:text-sm"
                    onClick={() => setPreviewMode("data")}
                  >
                    Show Data
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={previewMode === "summary" ? "default" : "ghost"}
                    className="rounded-full px-4 text-xs md:text-sm"
                    onClick={() => setPreviewMode("summary")}
                  >
                    Data Summary
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingData && (
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-muted-foreground">
                      Loading data...
                    </span>
                  </div>
                )}

                {dataError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error loading file</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>{(dataError as Error).message}</p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => refetchData()}
                          variant="outline"
                          size="sm"
                        >
                          Retry
                        </Button>
                        <Button
                          onClick={() => navigate("/")}
                          variant="outline"
                          size="sm"
                        >
                          Back to Home
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {fileData && !isLoadingData && !dataError && (
                  <div className="space-y-4">
                    {previewMode === "data" && hasPendingEdits && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Unsaved changes</AlertTitle>
                        <AlertDescription className="mt-2 flex items-center gap-2">
                          <Button
                            onClick={handleSaveChanges}
                            disabled={status === "saving"}
                            size="sm"
                          >
                            {status === "saving" ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={handleDiscardChanges}
                            disabled={status === "saving"}
                            variant="outline"
                            size="sm"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Discard
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}

                    {previewMode === "data" && (
                      <DataTable
                        columns={fileData.columns as string[]}
                        rows={fileData.rows as Array<Record<string, string>>}
                      />
                    )}

                    {previewMode === "summary" && (
                      <div className="rounded-xl border bg-slate-50">
                        <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
                          <table className="min-w-full text-xs md:text-sm">
                            <thead className="bg-slate-100">
                              <tr>
                                <th className="px-4 py-2 text-left font-semibold">
                                  Column
                                </th>
                                <th className="px-4 py-2 text-left font-semibold">
                                  Type
                                </th>
                                <th className="px-4 py-2 text-right font-semibold">
                                  Missing
                                </th>
                                <th className="px-4 py-2 text-right font-semibold">
                                  Missing %
                                </th>
                                <th className="px-4 py-2 text-right font-semibold">
                                  Unique Values
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {columnSummaries.map((col, idx) => (
                                <tr
                                  key={col.columnName}
                                  className={
                                    idx % 2 === 0 ? "bg-slate-50" : "bg-white"
                                  }
                                >
                                  <td className="px-4 py-2 font-medium">
                                    {col.columnName}
                                  </td>
                                  <td className="px-4 py-2">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold md:text-xs ${getTypeBadgeClass(
                                        col.type
                                      )}`}
                                    >
                                      {col.type}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    {col.missing}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    {col.missingPercent.toFixed(2)}%
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    {col.uniqueValues}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
