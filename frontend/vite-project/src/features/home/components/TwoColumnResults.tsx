import { useMultiCorrelationStore } from '@/store/multiCorrelationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

/**
 * Component to display detailed results for two-column correlation analysis
 */
export function TwoColumnResults() {
  const {
    correlationMatrix,
    matrixColumns,
    pairDetails,
    setCurrentStep,
  } = useMultiCorrelationStore();

  const handleBack = () => {
    setCurrentStep('methods');
  };

  if (!correlationMatrix || matrixColumns.length !== 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Results</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No analysis results available. Please go back and run the analysis.
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={handleBack} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Methods
          </Button>
        </CardContent>
      </Card>
    );
  }

  const col1 = matrixColumns[0];
  const col2 = matrixColumns[1];
  const pairKey = `${col1}::${col2}`;
  const reverseKey = `${col2}::${col1}`;
  const detailData = pairDetails[pairKey] || pairDetails[reverseKey];
  const cellData = correlationMatrix[col1]?.[col2];

  if (!detailData || !cellData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analysis Error</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Unable to retrieve analysis results. Please try running the analysis again.
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={handleBack} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Methods
          </Button>
        </CardContent>
      </Card>
    );
  }

  const correlation = cellData.correlation ?? null;
  const pValue = cellData.p_value ?? null;
  const isNA = correlation === null;
  const isSignificant = pValue !== null && pValue < 0.05;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Analysis Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Variables Section */}
            <div className="space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="font-semibold text-lg">Feature 1:</span>
                <span className="text-lg">{detailData.variable1_name}</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="font-semibold text-lg">Feature 2:</span>
                <span className="text-lg">{detailData.variable2_name}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Sample size:</p>
                  <p className="text-2xl font-bold">{detailData.sample_size}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {detailData.missing_category_rows && detailData.missing_category_rows > 0 
                      ? 'Rows with missing category removed:' 
                      : 'Rows with missing values removed:'}
                  </p>
                  <p className="text-2xl font-bold">{detailData.removed_rows}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* N/A Warning or Statistical Results */}
      {isNA ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">Analysis Not Available</p>
              <p>Unable to compute correlation. This may be due to:</p>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>Insufficient valid data after removing missing values</li>
                <li>No variation in one or both variables</li>
                <li>All values being the same in one or both variables</li>
              </ul>
              <p className="mt-3 text-sm">
                <strong>Suggestion:</strong> Try a different missing value handling method or check your data quality.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Statistical Results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Statistical Results</CardTitle>
              <p className="text-sm text-muted-foreground">Key statistics from the correlation analysis</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Significance Badge */}
              <div className="flex items-center gap-2">
                {isSignificant ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      Statistically Significant
                    </Badge>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-orange-600" />
                    <Badge variant="outline" className="border-orange-300 text-orange-800">
                      Not Significant
                    </Badge>
                  </>
                )}
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 gap-6">
                {/* Main statistic */}
                {detailData.result.statistic !== undefined && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {getStatisticLabel(cellData.method || '')}
                    </p>
                    <p className="text-3xl font-bold">{detailData.result.statistic.toFixed(4)}</p>
                  </div>
                )}

                {/* P-value */}
                {pValue !== null && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">P-value</p>
                    <p className="text-3xl font-bold">
                      {pValue < 0.0001 ? '< 0.0001' : pValue.toFixed(4)}
                    </p>
                  </div>
                )}

                {/* Effect size measures */}
                {detailData.result.effect_size !== undefined && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Effect Size</p>
                    <p className="text-3xl font-bold">{detailData.result.effect_size.toFixed(4)}</p>
                  </div>
                )}

                {detailData.result.eta_squared !== undefined && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Eta Squared (η²)</p>
                    <p className="text-3xl font-bold">{detailData.result.eta_squared.toFixed(4)}</p>
                  </div>
                )}

                {detailData.result.epsilon_squared !== undefined && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Epsilon Squared (ε²)</p>
                    <p className="text-3xl font-bold">{detailData.result.epsilon_squared.toFixed(4)}</p>
                  </div>
                )}

                {/* Degrees of freedom */}
                {detailData.result.df !== undefined && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Degrees of Freedom</p>
                    <p className="text-3xl font-bold">{detailData.result.df}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Interpretation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Interpretation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">
                {detailData.result.interpretation || generateInterpretation(cellData.method || '', correlation, pValue, detailData.result)}
              </p>
            </CardContent>
          </Card>

          {/* Method Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Method: {detailData.method_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {getMethodDescription(cellData.method || '')}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Back Button */}
      <div className="flex justify-start">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Methods
        </Button>
      </div>
    </div>
  );
}

function getStatisticLabel(method: string): string {
  const labels: Record<string, string> = {
    chi_square: 'Chi-square statistic (χ²)',
    phi: 'Phi coefficient (φ)',
    cramers_v: "Cramer's V",
    spearman: "Spearman's ρ",
    kendall_tau_b: "Kendall's τb",
    somers_d: "Somers' D",
    pearson_ordinal: 'Pearson r',
    anova_eta: 'F-statistic',
    kruskal_wallis: 'H-statistic',
  };
  return labels[method] || 'Test Statistic';
}

function generateInterpretation(method: string, correlation: number, pValue: number | null, result: any): string {
  const significance = pValue !== null && pValue < 0.05 ? 'significant' : 'not significant';
  const effectSize = Math.abs(correlation);
  
  let strength = 'negligible';
  if (effectSize >= 0.5) strength = 'large';
  else if (effectSize >= 0.3) strength = 'medium';
  else if (effectSize >= 0.1) strength = 'small';

  if (method === 'chi_square') {
    return `χ²(${result.df || 'N/A'}) = ${result.statistic?.toFixed(2) || 'N/A'}, p = ${pValue?.toFixed(4) || 'N/A'}. ${
      pValue !== null && pValue < 0.05
        ? 'There is a significant association between the variables.'
        : 'No significant association between the variables (p >= 0.05).'
    }`;
  }

  if (method === 'anova_eta' || method === 'kruskal_wallis') {
    const testName = method === 'anova_eta' ? 'One-way ANOVA' : 'Kruskal-Wallis';
    const effectMeasure = method === 'anova_eta' ? 'η²' : 'ε²';
    const effectValue = method === 'anova_eta' ? result.eta_squared : result.epsilon_squared;
    
    return `${testName}: H(${result.df || 'N/A'}) = ${result.statistic?.toFixed(2) || 'N/A'}, p = ${pValue?.toFixed(4) || 'N/A'}. ${effectMeasure} = ${effectValue?.toFixed(4) || '0'} (${strength} effect size). ${
      pValue !== null && pValue < 0.05
        ? 'Significant group differences detected.'
        : 'No significant group differences (p >= 0.05).'
    }`;
  }

  return `Correlation coefficient = ${correlation.toFixed(4)}, p = ${pValue?.toFixed(4) || 'N/A'}. This indicates a ${strength} ${correlation > 0 ? 'positive' : 'negative'} association that is ${significance}.`;
}

function getMethodDescription(method: string): string {
  const descriptions: Record<string, string> = {
    chi_square:
      'Chi-square test of independence (χ²) examines whether two nominal variables are statistically independent. A significant result indicates an association between the variables.',
    phi:
      'Phi coefficient (φ) is an association measure for 2×2 contingency tables with two binary nominal variables. Values range from -1 to 1.',
    cramers_v:
      "Cramer's V is a measure of association between two nominal variables, ranging from 0 (no association) to 1 (perfect association). It is appropriate for tables of any size.",
    spearman:
      "Spearman's rank correlation (ρ) measures the strength and direction of monotonic relationships between two ordinal variables. Values range from -1 to 1.",
    kendall_tau_b:
      "Kendall's tau-b (τb) is a non-parametric measure of ordinal association that accounts for ties. Values range from -1 to 1.",
    somers_d:
      "Somers' D is an asymmetric measure of ordinal association. It is useful when one variable is considered dependent on the other. Values range from -1 to 1.",
    pearson_ordinal:
      'Pearson correlation on ordinal scores treats the ordinal values as numeric scores and computes a standard Pearson correlation coefficient.',
    anova_eta:
      'One-way ANOVA with eta squared (η²) tests for differences in means across groups. Eta squared represents the proportion of variance in the ordinal variable explained by the nominal variable.',
    kruskal_wallis:
      'Kruskal-Wallis test with epsilon-squared (ε²) is a non-parametric alternative to ANOVA. Epsilon-squared measures effect size, indicating the strength of association between nominal and ordinal variables.',
  };

  return descriptions[method] || 'No description available for this method.';
}
