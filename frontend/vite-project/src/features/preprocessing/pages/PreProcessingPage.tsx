import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
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
import type { DataReductionSummary } from "../../home/api/uploads";
import { Loader2, AlertCircle, Download } from "lucide-react";
import { FileLayout } from "../../../components/layout/FileLayout";
import { ActionSidebarItem } from "../../../components/layout/ActionSidebarItem";
import { HandleMissingValuesPanel } from "../components/HandleMissingValuesPanel";
import { BinningPanel } from "../components/BinningPanel";
import { DataEncodingPanel } from "../components/DataEncodingPanel";
import { TextTransformationPanel } from "../components/TextTransformationPanel";
import { DataReductionPanel } from "../components/DataReductionPanel";
import { DataReductionSummaryView } from "../components/DataReductionSummaryView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { filterAnalysisColumns, isDateTimeColumn } from "../../../lib/columnFilters";

export function PreProcessingPage() {
  const navigate = useNavigate();
  const { fileId } = useParams<{ fileId?: string }>();
  const { user } = useAuthStore();

  const { setFile, modifiedCells } = useFileStore();
  const [activeTab, setActiveTab] = useState<string>("pre-processed");
  const [dataReductionSummary, setDataReductionSummary] = useState<DataReductionSummary | null>(null);

  // Download function to export data as CSV
  const downloadAsCSV = () => {
    if (!fileData) return;

    const columns = activeTab === "data-reduction" 
      ? fileData.columns.filter(col => col.match(/^DR\d+$/))
      : fileData.columns.filter(col => !col.match(/^DR\d+$/));
    
    if (columns.length === 0) return;

    // Create CSV header
    const csvHeader = columns.join(',');
    
    // Create CSV rows
    const csvRows = fileData.rows.map(row => {
      return columns.map(col => {
        const value = row[col];
        // Handle values with commas, quotes, or newlines
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });
    
    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = activeTab === "data-reduction" 
      ? `data_reduction_${Date.now()}.csv`
      : `preprocessed_data_${Date.now()}.csv`;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

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
        modifiedCells: fileData.modifiedCells,
        hasSummary: !!fileData.summary
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
      
      // Set data reduction summary if present in response
      if (fileData.summary) {
        setDataReductionSummary(fileData.summary);
      }
    }
  }, [fileData, fileId, user?.id, setFile]);

  if (!user || !fileId) {
    return null;
  }

  // Build actions sidebar with preprocessing panels
  const actions = [];

  if (fileData) {
    // Filter out date/time columns and 'id' column for preprocessing operations
    const nonDateTimeColumns = filterAnalysisColumns(fileData.columns, fileData.rows);

    // Allow all non-date/time columns for binning (including numeric with categorical meaning)
    const binnableColumns = nonDateTimeColumns;

    // Filter free text columns (only those categorized as "Text")
    const freeTextColumns = fileData.columns.filter((col) => {
      if (col === "id") return false;
      
      // Check if column contains long text (average length > 50 chars)
      const values = fileData.rows.map((row) => row[col]).filter((v) => v !== null && v !== undefined && v.trim() !== "");
      if (values.length === 0) return false;
      
      const avgLength = values.reduce((sum, v) => sum + v.length, 0) / values.length;
      return avgLength > 50;
    });

    actions.push(
      <ActionSidebarItem
        title="Free Text Transformation"
        key="text-transformation"
        tooltipText="Transform free text into categorical themes using AI"
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
        tooltipText="Group values into meaningful bins (works on categorical and numeric columns)"
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
        tooltipText="Reduce wide qualitative data into compact numeric components"
      >
        <DataReductionPanel
          columns={nonDateTimeColumns}
          userId={user.id}
          fileId={fileId}
          onSuccess={(summary) => {
            refetchData();
            if (summary) {
              setDataReductionSummary(summary);
              setActiveTab("data-reduction");
            }
          }}
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-[calc(100vh-200px)]">
              <div className="flex items-center justify-between flex-shrink-0 mb-4">
                <TabsList>
                  <TabsTrigger value="pre-processed">Pre-Processed Table</TabsTrigger>
                  <TabsTrigger value="data-reduction">Data Reduction</TabsTrigger>
                </TabsList>
                <Button 
                  onClick={downloadAsCSV}
                  variant="outline" 
                  size="sm"
                  disabled={activeTab === "data-reduction" && !fileData.columns.some(col => col.match(/^DR\d+$/))}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </div>
              
              <TabsContent value="pre-processed" className="mt-4 border rounded-lg flex-1 min-h-0 overflow-auto">
                <DataTable
                  columns={fileData.columns
                    .filter(col => !col.match(/^DR\d+$/))
                    .filter(col => {
                      // Filter out id column
                      if (col.toLowerCase() === 'id') return false;
                      // Filter out datetime columns using the same logic
                      return !isDateTimeColumn(col, fileData.rows);
                    })
                  }
                  rows={fileData.rows}
                  readOnly={true}
                  modifiedCells={modifiedCells}
                />
              </TabsContent>
              
              <TabsContent value="data-reduction" className="mt-4 flex-1 min-h-0 overflow-y-auto">
                {(() => {
                  const drColumns = fileData.columns.filter(col => col.match(/^DR\d+$/));
                  const hasDRColumns = drColumns.length > 0;
                  
                  return hasDRColumns ? (
                    <div className="space-y-4">
                      {/* Data Table at the top */}
                      <div className="border rounded-lg overflow-auto" style={{ height: '30vh' }}>
                        <DataTable
                          columns={drColumns}
                          rows={fileData.rows}
                          readOnly={true}
                          modifiedCells={modifiedCells}
                        />
                      </div>
                      
                      {/* Summary below - fixed, not scrollable */}
                      {dataReductionSummary && (
                        <div>
                          <DataReductionSummaryView summary={dataReductionSummary} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center border rounded-lg bg-muted/30">
                      <div className="text-center space-y-2">
                        <p className="text-muted-foreground">No data reduction has been applied yet.</p>
                        <p className="text-sm text-muted-foreground">
                          Use the "Data Reduction" panel on the right to perform dimensionality reduction.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </FileLayout>
  );
}





