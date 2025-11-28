import { useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
import { DataTable } from "../../../components/DataTable";
import {
  getFileData,
  updateFileData,
  updateColumnSelection,
} from "../api/uploads";
import { toast } from "sonner";
import { Loader2, AlertCircle, Save, X } from "lucide-react";
import { ColumnSelectionPanel } from "../../../components/ColumnSelectionPanel";
import { UploadSurface } from "../../../components/upload/UploadSurface";

export function HomePage() {
  const navigate = useNavigate();
  const { fileId } = useParams<{ fileId?: string }>();
  const { user } = useAuthStore();

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
            <UploadSurface variant="hero" />
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
