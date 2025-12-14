import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCorrelationStore } from '@/store/correlationStore';
import { CheckCircle2, XCircle, Info, Download, ArrowLeft } from 'lucide-react';

export function CorrelationResults() {
  const { results, setCurrentTab, resetResults } = useCorrelationStore();

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Info className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Results Yet</h3>
        <p className="text-muted-foreground mb-4">
          Configure your analysis and click "Run Analysis" to see results here.
        </p>
        <Button variant="outline" onClick={() => setCurrentTab('configuration')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go to Configuration
        </Button>
      </div>
    );
  }

  const isSignificant = results.result.p_value !== undefined && results.result.p_value < 0.05;

  const downloadResults = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `correlation_results_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analysis Results</h2>
          <p className="text-muted-foreground">
            {results.method_name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadResults}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={resetResults}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            New Analysis
          </Button>
        </div>
      </div>

      {/* Variables Info */}
      <Card>
        <CardHeader className="pb-2 py-3">
          <CardTitle>Variables Analyzed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 py-3">
          <div className="flex items-center gap-2">
            <span className="font-medium">Variable 1:</span>
            <Badge variant="secondary">{results.variable1_name}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Variable 2:</span>
            <Badge variant="secondary">{results.variable2_name}</Badge>
          </div>
          <hr className="my-2 border-border" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sample size:</span>
            <span className="font-medium">{results.sample_size}</span>
          </div>
          {results.removed_rows > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Rows with missing values removed:</span>
              <span className="font-medium">{results.removed_rows}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Results */}
      <Card>
        <CardHeader className="pb-2 py-3">
          <CardTitle>Statistical Results</CardTitle>
          <CardDescription>Key statistics from the correlation analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 py-3">
          {/* Significance Badge */}
          {results.result.p_value !== undefined && (
            <div className="flex items-center gap-2">
              {isSignificant ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <Badge variant="default" className="bg-green-600">
                    Statistically Significant
                  </Badge>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-orange-600" />
                  <Badge variant="secondary">Not Significant</Badge>
                </>
              )}
            </div>
          )}

          {/* Statistics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Statistic */}
            {results.result.statistic !== undefined && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Test Statistic</p>
                <p className="text-2xl font-bold">{results.result.statistic.toFixed(4)}</p>
              </div>
            )}

            {/* F-statistic */}
            {results.result.f_statistic !== undefined && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">F-statistic</p>
                <p className="text-2xl font-bold">{results.result.f_statistic.toFixed(4)}</p>
              </div>
            )}

            {/* H-statistic */}
            {results.result.h_statistic !== undefined && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">H-statistic</p>
                <p className="text-2xl font-bold">{results.result.h_statistic.toFixed(4)}</p>
              </div>
            )}

            {/* P-value */}
            {results.result.p_value !== undefined && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">P-value</p>
                <p className="text-2xl font-bold">
                  {results.result.p_value < 0.001
                    ? '< 0.001'
                    : results.result.p_value.toFixed(4)}
                </p>
              </div>
            )}

            {/* Eta Squared */}
            {results.result.eta_squared !== undefined && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Eta Squared (η²)</p>
                <p className="text-2xl font-bold">{results.result.eta_squared.toFixed(4)}</p>
              </div>
            )}

            {/* Epsilon Squared */}
            {results.result.epsilon_squared !== undefined && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Epsilon Squared (ε²)</p>
                <p className="text-2xl font-bold">{results.result.epsilon_squared.toFixed(4)}</p>
              </div>
            )}

            {/* Degrees of Freedom */}
            {results.result.df !== undefined && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Degrees of Freedom</p>
                <p className="text-2xl font-bold">{results.result.df}</p>
              </div>
            )}

            {/* DF Between/Within for ANOVA */}
            {results.result.df_between !== undefined && results.result.df_within !== undefined && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Degrees of Freedom</p>
                <p className="text-2xl font-bold">
                  ({results.result.df_between}, {results.result.df_within})
                </p>
              </div>
            )}
          </div>

          {/* Confidence Interval */}
          {results.result.confidence_interval && (
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">95% Confidence Interval</p>
              <p className="text-lg font-semibold">
                [{results.result.confidence_interval[0].toFixed(4)},{' '}
                {results.result.confidence_interval[1].toFixed(4)}]
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interpretation */}
      <Card>
        <CardHeader className="pb-2 py-3">
          <CardTitle>Interpretation</CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <p className="text-sm leading-relaxed">{results.result.interpretation}</p>
        </CardContent>
      </Card>
    </div>
  );
}
