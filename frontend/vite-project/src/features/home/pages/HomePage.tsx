import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
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
import { DataTable } from "../../../components/DataTable";
import {
  uploadFile,
  getFileData,
  updateFileData,
  updateColumnSelection,
} from "../api/uploads";
import { toast } from "sonner";
import {
  Loader2,
  AlertCircle,
  Save,
  X,
  Upload as UploadIcon,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import { ColumnSelectionPanel } from "../../../components/ColumnSelectionPanel";

export function HomePage() {
  const navigate = useNavigate();
  const { fileId } = useParams<{ fileId?: string }>();
  const { user } = useAuthStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  // Hydrate file store when data loads
  useEffect(() => {
    if (fileData && fileId && user?.id) {
      setFile(
        fileId,
        user.id,
        fileData.columns,
        fileData.rows,
        fileData.updated_at,
        fileData.selectionRanges || [],
        fileData.totalColumns || fileData.columns.length,
      );
    }
  }, [fileData, fileId, user?.id, setFile]);

  const uploadMutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: (data) => {
      toast.success("File uploaded successfully!");
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById(
        "csv-file-input",
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      // Navigate to the file ID route
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
        data.totalColumns,
      );
      refetchData();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update column selection");
    },
  });

  const validateAndSetFile = (file: File | null) => {
    if (file) {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Please select a CSV file");
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return false;
      }
      setSelectedFile(file);
      return true;
    }
    return false;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!validateAndSetFile(file || null)) {
      event.target.value = "";
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    validateAndSetFile(file || null);
  };

  const handleFileInputClick = () => {
    document.getElementById("csv-file-input")?.click();
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleSaveChanges = () => {
    if (!user?.id || !fileId || pendingEdits.size === 0) return;

    setSaving();
    const edits = Array.from(pendingEdits.entries()).map(
      ([rowId, changes]) => ({
        rowId,
        changes,
      }),
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
    ranges: Array<{ start: number; end: number }>,
  ) => {
    if (!user?.id || !fileId) return;

    // Warn if there are pending edits
    if (pendingEdits.size > 0) {
      const confirmed = window.confirm(
        "You have unsaved edits. Changing column selection will discard these edits. Continue?",
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

    // Warn if there are pending edits
    if (pendingEdits.size > 0) {
      const confirmed = window.confirm(
        "You have unsaved edits. Resetting column selection will discard these edits. Continue?",
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

  if (!user) {
    return null;
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Hero Upload Surface - shown when no file is loaded */}
      {!fileId && (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-8 md:p-12">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleFileInputClick}
              className={`
                cursor-pointer rounded-xl border-2 border-dashed p-12 md:p-16 text-center transition-all
                ${
                  isDragging
                    ? "border-[#3b5f9e] bg-blue-50"
                    : "border-gray-300 hover:border-[#3b5f9e] hover:bg-gray-50"
                }
              `}
            >
              <Input
                id="csv-file-input"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={uploadMutation.isPending}
                className="hidden"
              />

              <div className="flex flex-col items-center gap-6 max-w-lg mx-auto">
                <div
                  className={`
                    p-6 rounded-full transition-colors
                    ${isDragging ? "bg-blue-100" : "bg-gray-100"}
                  `}
                >
                  <FileSpreadsheet
                    className={`
                      h-16 w-16 transition-colors
                      ${isDragging ? "text-[#3b5f9e]" : "text-gray-400"}
                    `}
                  />
                </div>

                {selectedFile ? (
                  <div className="w-full space-y-4">
                    <div>
                      <p className="text-lg font-semibold text-gray-700 mb-1">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpload();
                      }}
                      disabled={uploadMutation.isPending}
                      size="lg"
                      className="w-full max-w-xs mx-auto bg-[#3b5f9e] hover:bg-[#345ca8]"
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <UploadIcon className="mr-2 h-5 w-5" />
                          Upload File
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-2xl font-semibold text-gray-700">
                      Drop your CSV file here
                    </p>
                    <p className="text-base text-gray-500">
                      or click to browse
                    </p>
                    <p className="text-sm text-gray-400 pt-2">
                      CSV files only • Max 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
          <CardHeader>
            <CardTitle>File Preview</CardTitle>
            <CardDescription>
              {fileData
                ? `Displaying ${fileData.rows.length} rows and ${fileData.columns.length} columns`
                : "Loading file data..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingData && (
              <div className="flex items-center justify-center h-64">
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
                {hasPendingEdits && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Unsaved changes</AlertTitle>
                    <AlertDescription className="flex items-center gap-2 mt-2">
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
                <DataTable columns={fileData.columns} rows={fileData.rows} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
