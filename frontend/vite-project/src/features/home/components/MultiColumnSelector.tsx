import { useMultiCorrelationStore } from '@/store/multiCorrelationStore';
import { useCorrelationStore } from '@/store/correlationStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowRight } from 'lucide-react';

export function MultiColumnSelector() {
  const {
    availableColumns,
    selectedColumns,
    toggleColumnSelection,
    setCurrentStep,
  } = useMultiCorrelationStore();

  const twoColStore = useCorrelationStore();

  const handleContinue = () => {
    if (selectedColumns.length >= 2) {
      // If exactly 2 columns, sync with two-column store
      if (selectedColumns.length === 2) {
        twoColStore.setSelectedColumn('col1', selectedColumns[0]);
        twoColStore.setSelectedColumn('col2', selectedColumns[1]);
      }
      setCurrentStep('configure');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 py-3">
        <CardTitle>Select Columns for Analysis</CardTitle>
        <CardDescription className="text-xs">
          Select at least 2 columns to analyze correlations (minimum 2, no maximum limit)
        </CardDescription>
      </CardHeader>
      <CardContent className="py-3">
        {availableColumns.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No columns available. Please go back and select columns in the Home page.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto mb-4 p-2 border rounded-md">
              {availableColumns.map((column) => (
                <div key={column} className="flex items-center space-x-2">
                  <Checkbox
                    id={`col-${column}`}
                    checked={selectedColumns.includes(column)}
                    onCheckedChange={() => toggleColumnSelection(column)}
                  />
                  <Label
                    htmlFor={`col-${column}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {column}
                  </Label>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Selected: <span className="font-semibold">{selectedColumns.length}</span> column
                {selectedColumns.length !== 1 ? 's' : ''}
              </p>

              <Button
                onClick={handleContinue}
                disabled={selectedColumns.length < 2}
              >
                Continue to Configuration
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {selectedColumns.length < 2 && selectedColumns.length > 0 && (
              <Alert className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please select at least one more column to proceed.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
