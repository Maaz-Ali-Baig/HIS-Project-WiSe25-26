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
import { BinningPanel } from "../components/BinningPanel";
import { DataEncodingPanel } from "../components/DataEncodingPanel";
import { TextTransformationPanel } from "../components/TextTransformationPanel";
import { DataReductionPanel } from "../components/DataReductionPanel";

export function PreProcessingPage() {
  const navigate = useNavigate();
  const { fileId } = useParams<{ fileId?: string }>();
  const { user } = useAuthStore();

  const { setFile, modifiedCells } = useFileStore();

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
      console.log("📊 File data loaded:", {
        columns: fileData.columns.length,
        rows: fileData.rows.length,
        modifiedCells: fileData.modifiedCells
      });
      setFile(
        fileId,
        user.id,
        fileData.columns,
        fileData.rows,
        fileData.updated_at,
        fileData.selectionRanges || [],
        fileData.totalColumns || fileData.columns.length,
        fileData.modifiedCells || [],
      );
    }
  }, [fileData, fileId, user?.id, setFile]);

  if (!user || !fileId) {
    return null;
  }

  // Build actions sidebar with preprocessing panels
  const actions = [];

  if (fileData) {
    // Helper function to detect if a column contains date/time data
    const isDateTimeColumn = (col: string): boolean => {
      const values = fileData.rows.map((row) => row[col]).filter((v) => v !== null && v !== undefined && v.trim() !== "");
      
      if (values.length === 0) return false;
      
      // Sample up to 50 values for performance
      const sampleSize = Math.min(values.length, 50);
      const sample = values.slice(0, sampleSize);
      
      // Common date/time patterns
      const dateTimePatterns = [
        /^\d{4}-\d{2}-\d{2}/, // ISO date: 2024-01-15
        /^\d{2}\/\d{2}\/\d{4}/, // US date: 01/15/2024
        /^\d{2}-\d{2}-\d{4}/, // Date: 15-01-2024
        /^\d{4}\/\d{2}\/\d{2}/, // Date: 2024/01/15
        /^\d{2}:\d{2}:\d{2}/, // Time: 14:30:45
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO timestamp: 2024-01-15T14:30:45
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, // Timestamp: 2024-01-15 14:30:45
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i, // Month names
        /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i, // Day names
        /^\d{13}$/, // Unix timestamp milliseconds
        /^\d{10}$/, // Unix timestamp seconds
      ];
      
      // Check if most values match date/time patterns
      let matchCount = 0;
      for (const value of sample) {
        if (dateTimePatterns.some(pattern => pattern.test(value))) {
          matchCount++;
        }
      }
      
      // If more than 70% match, consider it a date/time column
      return matchCount / sampleSize > 0.7;
    };

    // Analyze column types using same logic as DataSummary
    const getColumnType = (col: string) => {
      const values = fileData.rows.map((row) => row[col]);
      const nonEmptyValues = values.filter((v) => v !== null && v !== undefined && v.trim() !== "");
      const uniqueValues = new Set(nonEmptyValues);

      // Determine type
      if (nonEmptyValues.length === 0) return "Other";

      // Check if numeric
      const numericCount = nonEmptyValues.filter((v) => {
        try {
          return !isNaN(parseFloat(v.replace(/,/g, "")));
        } catch {
          return false;
        }
      }).length;

      if (numericCount / nonEmptyValues.length >= 0.8) {
        return "Numeric";
      } else {
        // Check if categorical (low unique ratio)
        const uniqueRatio = uniqueValues.size / nonEmptyValues.length;
        if (uniqueRatio < 0.5) {
          return "Categorical";
        } else if (nonEmptyValues.some((v) => v.length > 50)) {
          return "Text";
        } else {
          return "Other";
        }
      }
    };

    // Filter out date/time columns and 'id' column for preprocessing operations
    const nonDateTimeColumns = fileData.columns.filter((col) => 
      col !== "id" && !isDateTimeColumn(col)
    );

    // Allow all non-date/time columns for binning (including numeric with categorical meaning)
    const binnableColumns = nonDateTimeColumns;

    // Filter free text columns (only those categorized as "Text")
    const freeTextColumns = fileData.columns.filter((col) => {
      if (col === "id") return false;
      const type = getColumnType(col);
      return type === "Text";
    });

    actions.push(
      <ActionSidebarItem
        title="Free Text Transformation"
        key="text-transformation"
        tooltip="Transform free text into categorical themes using AI"
      >
        <TextTransformationPanel
          columns={freeTextColumns}
          userId={user.id}
          fileId={fileId}
          onSuccess={() => refetchData()}
        />
      </ActionSidebarItem>,
      <ActionSidebarItem title="Handle Missing Values" key="missing-values">
        <HandleMissingValuesPanel
          columns={nonDateTimeColumns}
          userId={user.id}
          fileId={fileId}
          onSuccess={() => refetchData()}
        />
      </ActionSidebarItem>,
      <ActionSidebarItem
        title="Categorical Binning"
        key="binning"
        tooltip="Group values into meaningful bins (works on categorical and numeric columns)"
      >
        <BinningPanel
          columns={binnableColumns}
          userId={user.id}
          fileId={fileId}
          onSuccess={() => refetchData()}
        />
      </ActionSidebarItem>,
      <ActionSidebarItem title="Data Encoding Techniques" key="data-encoding">
        <DataEncodingPanel
          columns={nonDateTimeColumns}
          userId={user.id}
          fileId={fileId}
          onSuccess={() => refetchData()}
        />
      </ActionSidebarItem>,
      <ActionSidebarItem
        title="Data Reduction"
        key="data-reduction"
        tooltip="Reduce wide qualitative data into compact numeric components"
      >
        <DataReductionPanel
          columns={nonDateTimeColumns}
          userId={user.id}
          fileId={fileId}
          onSuccess={() => refetchData()}
        />
      </ActionSidebarItem>,
    );
  }

  return (
    <FileLayout actions={actions}>
      <div className="w-full h-full flex flex-col gap-4">
        <div className="flex items-center justify-between flex-shrink-0 px-6 pt-4 pb-2">
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
          <div className="flex-1 min-h-0 px-6">
            <div className="h-[calc(100vh-200px)] border rounded-lg overflow-hidden">
              <DataTable
                columns={fileData.columns}
                rows={fileData.rows}
                readOnly={true}
                modifiedCells={modifiedCells}
              />
            </div>
          </div>
        )}
      </div>
    </FileLayout>
  );
}





