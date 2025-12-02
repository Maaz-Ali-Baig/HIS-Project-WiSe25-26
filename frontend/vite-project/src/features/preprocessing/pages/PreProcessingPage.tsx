import { useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../../store/auth";
import { useFileStore } from "../../../store/fileStore";
import { Button } from "../../../components/ui/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
import { DataTable } from "../../../components/DataTable";
import { getFileData } from "../../home/api/uploads";
import { Loader2, AlertCircle } from "lucide-react";
import { FileLayout } from "../../../components/layout/FileLayout";
import { ActionSidebarItem } from "../../../components/layout/ActionSidebarItem";
import { HandleMissingValuesPanel } from "../components/HandleMissingValuesPanel";
import { DataEncodingPanel } from "../components/DataEncodingPanel";

export function PreProcessingPage() {
  const navigate = useNavigate();
  const { fileId } = useParams<{ fileId?: string }>();
  const { user } = useAuthStore();

  const { setFile } = useFileStore();

  // Redirect if no fileId
  useEffect(() => {
    if (!fileId) {
      navigate("/");
    }
  }, [fileId, navigate]);

  // Fetch file data
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

  if (!user || !fileId) {
    return null;
  }

  // Build actions sidebar with preprocessing panels
  const actions = [];

  if (fileData) {
    actions.push(
      <ActionSidebarItem title="Handle Missing Values" key="missing-values">
        <HandleMissingValuesPanel
          columns={fileData.columns}
          userId={user.id}
          fileId={fileId}
          onSuccess={() => refetchData()}
        />
      </ActionSidebarItem>,
      <ActionSidebarItem title="Data Encoding Techniques" key="data-encoding">
        <DataEncodingPanel columns={fileData.columns} />
      </ActionSidebarItem>,
    );
  }

  return (
    <FileLayout actions={actions}>
      <div className="w-full h-full flex flex-col gap-4">
        <div className="flex items-center justify-between flex-shrink-0 px-6 pt-6 pb-2">
          <div>
            <h2 className="text-2xl font-semibold">Pre-Processing</h2>
            <p className="text-sm text-muted-foreground">
              {fileData
                ? `Viewing ${fileData.rows.length} rows and ${fileData.columns.length} columns (read-only)`
                : "Loading data..."}
            </p>
          </div>
        </div>

        {isLoadingData && (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-muted-foreground">Loading data...</span>
          </div>
        )}

        {dataError && (
          <Alert variant="destructive" className="flex-shrink-0 mx-6">
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
          <div className="flex-1 min-h-0 px-6 pb-6">
            <DataTable
              columns={fileData.columns}
              rows={fileData.rows}
              readOnly={true}
            />
          </div>
        )}
      </div>
    </FileLayout>
  );
}
