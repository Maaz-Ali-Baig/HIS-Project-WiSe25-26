import React, { useEffect, useState } from 'react';
import { TopNav } from '../../../components/TopNav';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { useCorrelationStore } from '../../../store/correlationStore';
import { useMultiCorrelationStore } from '../../../store/multiCorrelationStore';
import { useFileStore } from '../../../store/fileStore';
import { MultiColumnSelector } from '../components/MultiColumnSelector';
import { BatchVariableConfigurator } from '../components/BatchVariableConfigurator';
import { MissingValueHandler } from '../components/MissingValueHandler';
import { PairTypeMethodSelector } from '../components/PairTypeMethodSelector';
import { CorrelationMatrixDisplay } from '../components/CorrelationMatrixDisplay';
import { CorrelationDetailModal } from '../components/CorrelationDetailModal';
import { TwoColumnResults } from '../components/TwoColumnResults';
import { getColumnInfo, checkCorrelationHealth } from '../api/correlation';

export function CorrelationAnalysisPage() {
  const {
    error,
    setAvailableColumns,
    setError,
    reset,
  } = useCorrelationStore();

  const multiStore = useMultiCorrelationStore();
  const { userId, fileId } = useFileStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [healthCheck, setHealthCheck] = useState<{
    checked: boolean;
    healthy: boolean;
    message: string;
  }>({ checked: false, healthy: false, message: '' });

  // Check R installation and load column data on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Check if user has selected a file
        if (!userId || !fileId) {
          console.log('No userId or fileId:', { userId, fileId });
          setError('No file selected. Please select and preview a file from the Home page first.');
          setHealthCheck({
            checked: false,
            healthy: false,
            message: 'No file selected',
          });
          setIsLoading(false);
          return;
        }

        console.log('Initializing correlation analysis with:', { userId, fileId });

        // Check if R is installed
        try {
          const health = await checkCorrelationHealth();
          console.log('R health check:', health);
          setHealthCheck({
            checked: true,
            healthy: health.r_installed,
            message: health.message,
          });
        } catch (healthErr) {
          console.warn('Could not check R health:', healthErr);
          setHealthCheck({
            checked: true,
            healthy: false,
            message: 'Could not connect to backend. Please ensure the server is running.',
          });
        }

        // Load available columns
        try {
          console.log('Fetching column info for:', { userId, fileId });
          const columnInfo = await getColumnInfo(userId, fileId);
          console.log('Column info received:', columnInfo);
          if (columnInfo.columns.length === 0) {
            setError('No columns found in the selected file. Please select a different file.');
          } else {
            // Set columns for both stores
            setAvailableColumns(columnInfo.columns, columnInfo.categories);
            multiStore.setFileContext(userId, fileId);
            multiStore.setAvailableColumns(columnInfo.columns, columnInfo.categories);
            setError(null); // Clear any previous errors
          }
        } catch (columnErr: any) {
          console.error('Error loading columns:', columnErr);
          console.error('Error response:', columnErr.response);
          const errorMsg = columnErr.response?.data?.detail || 'Failed to load column data. Please ensure your file is properly selected.';
          setError(errorMsg);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setError('An unexpected error occurred during initialization.');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      // Cleanup on unmount
      reset();
      multiStore.reset();
    };
  }, [userId, fileId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav active="correlation" />
        <main className="flex justify-center items-center px-4 py-16">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading correlation analysis...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav active="correlation" />

      <main className="flex justify-center px-4 py-8">
        <div className="w-full max-w-6xl space-y-6">
          {/* Header Card */}
          <Card>
            <CardHeader>
              <CardTitle>Correlation Analysis</CardTitle>
              <CardDescription>
                Select columns to begin. Choose 2 columns for pairwise analysis or 3+ columns for a correlation matrix.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* No File Selected Warning */}
          {(!userId || !fileId) && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>No file selected.</strong> Please go to the Home page, upload a CSV file, select columns, and preview the data before performing correlation analysis.
              </AlertDescription>
            </Alert>
          )}

          {/* R Installation Warning */}
          {healthCheck.checked && !healthCheck.healthy && userId && fileId && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>R is not installed or not accessible.</strong> {healthCheck.message}
                <br />
                Please install R and ensure it's available in your system PATH to use correlation analysis.
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && userId && fileId && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Multi-Step Workflow */}
          {userId && fileId && (
            <div className="space-y-4">
              {/* Step Progress Indicator */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-2">
                    {[
                      { key: 'select', label: 'Select Features' },
                      { key: 'configure', label: 'Configure' },
                      { key: 'missing', label: 'Handle Missing Values' },
                      { key: 'methods', label: 'Analysis Method' },
                      { key: 'results', label: 'Results' },
                    ].map((step, idx, arr) => (
                      <React.Fragment key={step.key}>
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors flex-shrink-0 ${
                              multiStore.currentStep === step.key
                                ? 'bg-red-600 text-white'
                                : arr.findIndex((s) => s.key === multiStore.currentStep) > idx
                                ? 'bg-red-200 text-red-700'
                                : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <div
                            className={`text-xs mt-2 text-center whitespace-nowrap ${
                              multiStore.currentStep === step.key ? 'font-semibold' : 'text-muted-foreground'
                            }`}
                          >
                            {step.label}
                          </div>
                        </div>
                        {idx < arr.length - 1 && (
                          <div className="h-1 bg-red-600 flex-1" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Dynamic Step Content */}
              {multiStore.currentStep === 'select' && <MultiColumnSelector />}
              {multiStore.currentStep === 'configure' && <BatchVariableConfigurator />}
              {multiStore.currentStep === 'missing' && <MissingValueHandler />}
              {multiStore.currentStep === 'methods' && <PairTypeMethodSelector />}
              {multiStore.currentStep === 'results' && (
                multiStore.selectedColumns.length === 2 ? (
                  // Show detailed results for 2 columns
                  <TwoColumnResults />
                ) : (
                  // Show matrix for 3+ columns
                  <CorrelationMatrixDisplay />
                )
              )}

              {/* Info Alerts */}
              {multiStore.currentStep === 'select' && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Tip:</strong> Select at least 2 columns. For 2 columns, standard pairwise analysis will be performed. For 3+ columns, a correlation matrix will be generated.
                  </AlertDescription>
                </Alert>
              )}

              {multiStore.currentStep === 'configure' && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Tip:</strong> For ordinal variables, ensure the ranking reflects the natural order
                    of your categories (e.g., "Low" = 1, "Medium" = 2, "High" = 3).
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal for multi-column */}
      <CorrelationDetailModal />
    </div>
  );
}
