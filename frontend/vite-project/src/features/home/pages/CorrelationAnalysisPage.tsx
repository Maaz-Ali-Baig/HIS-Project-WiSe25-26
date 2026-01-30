/**
 * CorrelationAnalysisPage
 * Main page for correlation analysis with multi-step workflow
 */
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMultiCorrelationStore } from "../../../store/multiCorrelationStore";
import { useAuthStore } from "../../../store/auth";
import { isDateTimeColumn } from "../../../lib/columnFilters";
import {
  checkHealth,
  getColumns,
  checkMissingValues,
  analyzeCorrelationMatrix,
} from "../api/correlation";
import type { MatrixCell } from "../api/correlation";
import { MultiColumnSelector } from "../components/MultiColumnSelector";
import { BatchVariableConfigurator } from "../components/BatchVariableConfigurator";
import { MissingValueHandler } from "../components/MissingValueHandler";
import { PairTypeMethodSelector } from "../components/PairTypeMethodSelector";
import { CorrelationMatrixDisplay } from "../components/CorrelationMatrixDisplay";
import { CorrelationDetailModal } from "../components/CorrelationDetailModal";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const CorrelationAnalysisPage: React.FC = () => {
  const { fileId } = useParams<{ fileId?: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const store = useMultiCorrelationStore();
  const [rHealthy, setRHealthy] = useState<boolean | null>(null);
  const [selectedCell, setSelectedCell] = useState<MatrixCell | null>(null);
  const [showOnlyCategorical, setShowOnlyCategorical] = useState<boolean>(false);
  const [categoricalColumns, setCategoricalColumns] = useState<string[]>([]);

  // Redirect if no fileId or user
  useEffect(() => {
    if (!fileId || !user) {
      navigate("/");
    }
  }, [fileId, user, navigate]);

  // Initialize - check R health and load columns
  useEffect(() => {
    if (!fileId || !user) return;

    const initialize = async () => {
      try {
        // Check R installation
        const health = await checkHealth();
        setRHealthy(health.r_installed);

        if (!health.r_installed) {
          store.setError(
            "R is not installed. Please install R to use correlation analysis.",
          );
          return;
        }

        // Get userId from auth store
        const userId = user.id.toString();

        store.setDataSource(userId, fileId);

        // Load available columns
        const columnsData = await getColumns(userId, fileId);
        
        // Additional client-side filtering to ensure datetime columns are excluded
        // (backend already filters, but this is a backup for cached data)
        const filteredColumns = columnsData.columns.filter(col => {
          if (col.toLowerCase() === 'id') return false;
          // We can't check actual data here, so rely on backend filtering
          // Backend already excludes datetime columns
          return true;
        });
        
        // Identify categorical columns (those with categories returned)
        // These are columns with discrete values suitable for categorical analysis
        const categorical = filteredColumns.filter(col => {
          const categories = columnsData.categories[col] || [];
          // Consider as categorical if it has categories or has < 50 unique values
          return categories.length > 0 && categories.length < 50;
        });
        setCategoricalColumns(categorical);
        
        store.setAvailableColumns(filteredColumns, columnsData.categories);
      } catch (error: any) {
        store.setError(
          error.response?.data?.detail ||
            "Failed to initialize correlation analysis",
        );
      }
    };

    initialize();
  }, [fileId, user]);

  // Step 1: Select columns
  const handleColumnSelection = async () => {
    if (store.selectedColumns.length < 2) {
      store.setError("Please select at least 2 columns");
      return;
    }

    try {
      store.setLoading(true);
      store.setError(null);

      // Check for missing values
      const missingData = await checkMissingValues({
        userId: store.userId!,
        fileId: store.fileId!,
        columns: store.selectedColumns,
      });

      store.setMissingValueInfo(
        missingData.columnsInfo,
        missingData.hasMissing,
      );
      
      // Set default nominal configuration for newly selected columns
      const currentConfigs = { ...store.variableConfigs };
      
      // Remove configs for deselected columns
      Object.keys(currentConfigs).forEach((col) => {
        if (!store.selectedColumns.includes(col)) {
          delete currentConfigs[col];
        }
      });
      
      // Add default nominal config for columns without configuration
      store.selectedColumns.forEach((col) => {
        if (!currentConfigs[col]) {
          const categories = store.columnCategories[col] || [];
          currentConfigs[col] = {
            columnName: col,
            type: "nominal",
            categories: categories,
            ordering: null,
          };
        }
      });
      
      // Update all configs in store
      Object.keys(currentConfigs).forEach((col) => {
        store.setVariableConfig(col, currentConfigs[col]);
      });
      
      store.setCurrentStep("configure");
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || "Failed to check missing values";
      store.setError(`Error checking missing values: ${errorMsg}`);
    } finally {
      store.setLoading(false);
    }
  };

  // Step 2: Configure variables
  const handleConfigurationComplete = () => {
    const allConfigured = store.selectedColumns.every(
      (col) => store.variableConfigs[col],
    );

    if (!allConfigured) {
      store.setError("Please configure all selected columns");
      return;
    }

    if (store.hasMissingValues) {
      store.setCurrentStep("missing");
    } else {
      store.setCurrentStep("methods");
    }
  };

  // Step 3: Handle missing values (if any)
  const handleMissingValueSelection = () => {
    store.setCurrentStep("methods");
  };

  // Step 4: Analyze
  const handleAnalyze = async () => {
    try {
      store.setLoading(true);
      store.setError(null);

      const result = await analyzeCorrelationMatrix({
        userId: store.userId!,
        fileId: store.fileId!,
        columns: store.selectedColumns,
        variableConfigs: store.variableConfigs,
        missingValueMethod: store.selectedMissingValueMethod,
        methodsByPairType: store.methodsByPairType,
      });

      store.setMatrixResult(result);
      store.setCurrentStep("results");
    } catch (error: any) {
      let errorMsg = "Analysis failed";
      
      if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      // Add helpful context
      if (errorMsg.toLowerCase().includes('r')) {
        errorMsg += ". Please ensure R is properly installed and the required packages are available.";
      }
      
      store.setError(`Correlation Analysis Error: ${errorMsg}`);
    } finally {
      store.setLoading(false);
    }
  };

  // Handle cell click
  const handleCellClick = (cell: MatrixCell) => {
    if (cell.is_diagonal) return;

    const pairKey = `${cell.row_name}::${cell.col_name}`;
    const altKey = `${cell.col_name}::${cell.row_name}`;
    const details =
      store.matrixResult?.pairDetails[pairKey] ||
      store.matrixResult?.pairDetails[altKey];

    if (!details) return;

    // Normalize the cell order to match the found details
    const normalizedCell = store.matrixResult?.pairDetails[pairKey]
      ? cell
      : {
          ...cell,
          row_name: details.variable1_name,
          col_name: details.variable2_name,
        };

    setSelectedCell(normalizedCell);
  };

  // Reset analysis
  const handleReset = () => {
    store.reset();
    store.setCurrentStep("select");
  };

  if (rHealthy === false) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 mt-1" size={24} />
            <div>
              <h2 className="text-lg font-semibold text-red-900 mb-2">
                R Not Installed
              </h2>
              <p className="text-red-800">
                The correlation analysis feature requires R to be installed on
                your system. Please install R from{" "}
                <a
                  href="https://cran.r-project.org/"
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://cran.r-project.org/
                </a>{" "}
                and add it to your PATH.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (rHealthy === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="bg-background w-full min-h-screen p-6">
      <div className="mx-auto w-full space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Correlation Analysis</CardTitle>
            <CardDescription className="text-sm">
              Analyze correlations between multiple categorical variables using
              statistical methods.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-3">
            {/* Progress indicator */}
            <div className="flex items-center justify-between gap-2 py-2">
              {["select", "configure", "missing", "methods", "results"].map(
                (step, idx, arr) => {
                  const currentIndex = arr.indexOf(store.currentStep);
                  const isActive = currentIndex === idx;
                  const isComplete = currentIndex > idx;
                  return (
                    <React.Fragment key={step}>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Badge
                          variant={
                            isActive
                              ? "default"
                              : isComplete
                                ? "secondary"
                                : "outline"
                          }
                          className="h-6 px-2 text-[0.7rem] uppercase tracking-wide"
                        >
                          {idx + 1}. {step}
                        </Badge>
                      </div>
                      {idx < 4 && (
                        <div className="flex-1 h-px bg-border" aria-hidden />
                      )}
                    </React.Fragment>
                  );
                },
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error display */}
        {store.error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-destructive mt-0.5 flex-shrink-0" size={20} />
                <div className="flex-1 space-y-2">
                  <h4 className="font-semibold text-destructive">Error</h4>
                  <p className="text-sm text-destructive/90 leading-relaxed whitespace-pre-wrap">{store.error}</p>
                  <Button
                    onClick={() => store.setError(null)}
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-xs"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main content */}
        <Card>
          <CardContent className="p-6">
            {/* Step 1: Column Selection */}
            {store.currentStep === "select" && (
              <div className="space-y-4">
                <MultiColumnSelector
                  availableColumns={store.availableColumns}
                  selectedColumns={store.selectedColumns}
                  onAddColumn={store.addColumn}
                  onRemoveColumn={store.removeColumn}
                  minColumns={2}
                  categoricalColumns={categoricalColumns}
                  showOnlyCategorical={showOnlyCategorical}
                  onToggleOnlyCategorical={setShowOnlyCategorical}
                />

                <div className="flex justify-between">
                  <Button
                    onClick={store.reset}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RotateCcw size={14} />
                    Reset
                  </Button>
                  <Button
                    onClick={handleColumnSelection}
                    disabled={
                      store.selectedColumns.length < 2 || store.isLoading
                    }
                    className="flex items-center gap-2"
                  >
                    {store.isLoading && (
                      <Loader2 className="animate-spin" size={16} />
                    )}
                    Next: Configure Variables
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Variable Configuration */}
            {store.currentStep === "configure" && (
              <div className="space-y-4">
                <BatchVariableConfigurator
                  columns={store.selectedColumns}
                  categories={store.columnCategories}
                  variableConfigs={store.variableConfigs}
                  onConfigChange={store.setVariableConfig}
                />

                <div className="flex justify-between">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => store.setCurrentStep("select")}
                      variant="outline"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={store.reset}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <RotateCcw size={14} />
                      Reset
                    </Button>
                  </div>
                  <Button
                    onClick={handleConfigurationComplete}
                    disabled={
                      Object.keys(store.variableConfigs).length !==
                      store.selectedColumns.length
                    }
                  >
                    {store.hasMissingValues
                      ? "Next: Handle Missing Values"
                      : "Next: Select Methods"}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Missing Value Handling */}
            {store.currentStep === "missing" && (
              <div className="space-y-4">
                <MissingValueHandler
                  missingValueInfo={store.missingValueInfo}
                  hasMissing={store.hasMissingValues}
                  selectedMethod={store.selectedMissingValueMethod}
                  onMethodChange={store.setMissingValueMethod}
                />

                <div className="flex justify-between">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => store.setCurrentStep("configure")}
                      variant="outline"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={store.reset}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <RotateCcw size={14} />
                      Reset
                    </Button>
                  </div>
                  <Button onClick={handleMissingValueSelection}>
                    Next: Select Methods
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Method Selection */}
            {store.currentStep === "methods" && (
              <div className="space-y-4">
                <PairTypeMethodSelector
                  methodsByPairType={store.methodsByPairType}
                  onMethodChange={store.setMethodForPairType}
                />

                <div className="flex justify-between">
                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        store.setCurrentStep(
                          store.hasMissingValues ? "missing" : "configure",
                        )
                      }
                      variant="outline"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={store.reset}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <RotateCcw size={14} />
                      Reset
                    </Button>
                  </div>
                  <Button
                    onClick={handleAnalyze}
                    disabled={store.isLoading}
                    className="flex items-center gap-2"
                  >
                    {store.isLoading && (
                      <Loader2 className="animate-spin" size={16} />
                    )}
                    Analyze Correlations
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Results */}
            {store.currentStep === "results" && store.matrixResult && (
              <div className="space-y-4">
                <CorrelationMatrixDisplay
                  result={store.matrixResult}
                  onCellClick={handleCellClick}
                />

                <div className="flex justify-between">
                  <Button onClick={handleReset} variant="outline">
                    New Analysis
                  </Button>
                  <Button
                    onClick={() => store.setCurrentStep("methods")}
                    variant="outline"
                  >
                    Change Methods
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      {selectedCell && store.matrixResult && (
        <CorrelationDetailModal
          result={
            store.matrixResult.pairDetails[
              `${selectedCell.row_name}::${selectedCell.col_name}`
            ] ||
            store.matrixResult.pairDetails[
              `${selectedCell.col_name}::${selectedCell.row_name}`
            ]
          }
          onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  );
};
