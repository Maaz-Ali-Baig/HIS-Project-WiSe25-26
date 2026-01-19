import { useEffect, useState } from 'react';
import { TopNav } from '../../../components/TopNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { useMultiCorrelationStore } from '../../../store/multiCorrelationStore';
import { useFileStore } from '../../../store/fileStore';
import { MultiColumnSelector } from '../components/MultiColumnSelector';
import { BatchVariableConfigurator } from '../components/BatchVariableConfigurator';
import { MissingValueHandler } from '../components/MissingValueHandler';
import { PairTypeMethodSelector } from '../components/PairTypeMethodSelector';
import { CorrelationMatrixDisplay } from '../components/CorrelationMatrixDisplay';
import { CorrelationDetailModal } from '../components/CorrelationDetailModal';
import { getColumns, checkHealth } from '../api/correlation';

export function MultiColumnCorrelationPage() {
  const {
    currentStep,
    error: analysisError,
    setFileContext,
    setAvailableColumns,
    setError,
    reset,
  } = useMultiCorrelationStore();

  const { userId, fileId } = useFileStore();

  const [isInitializing, setIsInitializing] = useState(true);
  const [healthCheck, setHealthCheck] = useState<{
    checked: boolean;
    healthy: boolean;
    message: string;
  }>({ checked: false, healthy: false, message: '' });

  // Initialize: check R health and load columns
  useEffect(() => {
    const initialize = async () => {
      try {
        // Check if user has selected a file
        if (!userId || !fileId) {
          setError('No file selected. Please select and preview a file from the Home page first.');
          setHealthCheck({
            checked: false,
            healthy: false,
            message: 'No file selected',
          });
          setIsInitializing(false);
          return;
        }

        // Set file context in store
        setFileContext(userId, fileId);

        // Check if R is installed
        try {
          const health = await checkHealth();
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
          const columnInfo = await getColumns(userId, fileId);
          if (columnInfo.columns.length === 0) {
            setError('No columns found in the selected file. Please select a different file.');
          } else {
            setAvailableColumns(columnInfo.columns, columnInfo.categories);
            setError(null);
          }
        } catch (columnErr: any) {
          const errorMsg =
            columnErr.response?.data?.detail ||
            'Failed to load column data. Please ensure your file is properly selected.';
          setError(errorMsg);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Failed to initialize correlation analysis');
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      reset();
    };
  }, [userId, fileId, setFileContext, setAvailableColumns, setError, reset]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav active="correlation" />
        <main className="container py-6">
          <div className="flex items-center justify-center h-96">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-muted-foreground">Loading correlation analysis...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!healthCheck.healthy) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav active="correlation" />
        <main className="container py-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-2">R Installation Issue</div>
              <p>{healthCheck.message}</p>
              <p className="mt-2 text-sm">
                Correlation analysis requires R to be installed. Please install R from{' '}
                <a
                  href="https://cran.r-project.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  CRAN
                </a>{' '}
                and restart the application.
              </p>
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  if (analysisError) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav active="correlation" />
        <main className="container py-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-2">Error</div>
              <p>{analysisError}</p>
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  // Step indicator
  const steps = [
    { key: 'select', label: 'Select Columns' },
    { key: 'configure', label: 'Configure Variables' },
    { key: 'missing', label: 'Handle Missing' },
    { key: 'methods', label: 'Select Methods' },
    { key: 'results', label: 'View Results' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="min-h-screen bg-background">
      <TopNav active="correlation" />
      <main className="container py-6">
        <div className="space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-3xl font-bold tracking-tight">
                    Multi-Column Correlation Analysis
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Analyze correlations between multiple variables and view a correlation matrix
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = '/correlation')}
                  className="ml-4"
                >
                  ← Two Variable Analysis
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Step Progress Indicator */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                {steps.map((step, idx) => (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                          idx === currentStepIndex
                            ? 'bg-purple-600 text-white'
                            : idx < currentStepIndex
                            ? 'bg-purple-200 text-purple-700'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div
                        className={`text-xs mt-1 text-center ${
                          idx === currentStepIndex ? 'font-semibold' : 'text-muted-foreground'
                        }`}
                      >
                        {step.label}
                      </div>
                    </div>
                    {idx < steps.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 mx-2 ${
                          idx < currentStepIndex ? 'bg-purple-300' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Main Content Area */}
          <div className="space-y-4">
            {currentStep === 'select' && <MultiColumnSelector />}
            {currentStep === 'configure' && <BatchVariableConfigurator />}
            {currentStep === 'missing' && <MissingValueHandler />}
            {currentStep === 'methods' && <PairTypeMethodSelector />}
            {currentStep === 'results' && <CorrelationMatrixDisplay />}
          </div>

          {/* Info Alert */}
          {currentStep === 'select' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Tip:</strong> Select at least 2 columns to begin your multi-column correlation
                analysis. You can select as many columns as needed.
              </AlertDescription>
            </Alert>
          )}

          {currentStep === 'configure' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Tip:</strong> For ordinal variables, ensure the ranking reflects the natural order
                of your categories (e.g., "Low" = 1, "Medium" = 2, "High" = 3).
              </AlertDescription>
            </Alert>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      <CorrelationDetailModal />
    </div>
  );
}
