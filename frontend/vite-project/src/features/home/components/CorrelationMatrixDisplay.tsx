import { useMultiCorrelationStore } from '@/store/multiCorrelationStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Color scale for correlation strength
const getCorrelationColor = (value: number | null): string => {
  if (value === null) return 'bg-gray-100 text-gray-500';
  const abs = Math.abs(value);
  if (abs === 1) return 'bg-purple-600 text-white';
  if (abs >= 0.8) return 'bg-purple-500 text-white';
  if (abs >= 0.6) return 'bg-purple-400 text-white';
  if (abs >= 0.4) return 'bg-purple-300 text-purple-900';
  if (abs >= 0.2) return 'bg-purple-200 text-purple-800';
  return 'bg-purple-100 text-purple-700';
};

export function CorrelationMatrixDisplay() {
  const {
    correlationMatrix,
    matrixColumns,
    setSelectedCell,
    setCurrentStep,
  } = useMultiCorrelationStore();

  const handleBack = () => {
    setCurrentStep('methods');
  };

  const handleCellClick = (row: string, col: string) => {
    if (row === col) return; // Skip diagonal clicks
    setSelectedCell({ row, col });
  };

  if (!correlationMatrix || matrixColumns.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2 py-3">
          <CardTitle>No Results</CardTitle>
          <CardDescription className="text-xs">
            No correlation matrix data available
          </CardDescription>
        </CardHeader>
        <CardContent className="py-3">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Check for N/A values in the matrix
  const hasNAValues = matrixColumns.some((row) =>
    matrixColumns.some((col) => {
      const cellData = correlationMatrix[row]?.[col];
      return !cellData?.is_diagonal && cellData?.correlation === null;
    })
  );

  return (
    <Card>
      <CardHeader className="pb-2 py-3">
        <CardTitle>Correlation Matrix</CardTitle>
        <CardDescription className="text-xs flex items-center gap-2">
          <Info className="h-3 w-3" />
          Click on a cell to view detailed analysis results
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 py-3">
        {/* Warning for N/A values */}
        {hasNAValues && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Warning:</strong> Some correlations show "N/A". This typically occurs when:
              <ul className="list-disc ml-5 mt-1">
                <li>A column has all missing values after your selected handling method</li>
                <li>A column has insufficient variation (all same value)</li>
                <li>There's not enough valid data after removing missing values</li>
              </ul>
              Try using a different missing value handling method or removing problematic columns.
            </AlertDescription>
          </Alert>
        )}
        {/* Legend */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="font-semibold">Strength:</span>
          <div className="flex items-center gap-1">
            <div className="w-12 h-5 bg-purple-100 border rounded flex items-center justify-center text-[10px]">
              0-0.2
            </div>
            <div className="w-12 h-5 bg-purple-200 border rounded flex items-center justify-center text-[10px]">
              0.2-0.4
            </div>
            <div className="w-12 h-5 bg-purple-300 border rounded flex items-center justify-center text-[10px]">
              0.4-0.6
            </div>
            <div className="w-12 h-5 bg-purple-400 text-white border rounded flex items-center justify-center text-[10px]">
              0.6-0.8
            </div>
            <div className="w-12 h-5 bg-purple-500 text-white border rounded flex items-center justify-center text-[10px]">
              0.8-1.0
            </div>
          </div>
        </div>

        {/* Matrix */}
        <div className="overflow-x-auto">
          <table className="border-collapse w-full text-sm">
            <thead>
              <tr>
                <th className="border p-2 bg-muted font-semibold text-left min-w-[120px]"></th>
                {matrixColumns.map((col) => (
                  <th key={col} className="border p-2 bg-muted font-semibold min-w-[100px] text-center">
                    <div className="truncate" title={col}>
                      {col}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixColumns.map((rowCol) => (
                <tr key={rowCol}>
                  <td className="border p-2 bg-muted font-semibold">
                    <div className="truncate" title={rowCol}>
                      {rowCol}
                    </div>
                  </td>
                  {matrixColumns.map((colCol) => {
                    const cellData = correlationMatrix[rowCol]?.[colCol];
                    const value = cellData?.correlation ?? null;
                    const isDiagonal = cellData?.is_diagonal ?? (rowCol === colCol);

                    return (
                      <td
                        key={colCol}
                        className={cn(
                          'border p-2 text-center font-semibold cursor-pointer transition-all hover:ring-2 hover:ring-purple-400',
                          getCorrelationColor(value),
                          isDiagonal && 'cursor-default opacity-50'
                        )}
                        onClick={() => !isDiagonal && handleCellClick(rowCol, colCol)}
                        title={
                          isDiagonal
                            ? 'Self-correlation'
                            : `${cellData?.method || 'N/A'}: ${value !== null ? value.toFixed(3) : 'N/A'}`
                        }
                      >
                        {value !== null ? value.toFixed(3) : 'N/A'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Methods
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              // Reset to start new analysis
              setCurrentStep('select');
            }}
          >
            New Analysis
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
