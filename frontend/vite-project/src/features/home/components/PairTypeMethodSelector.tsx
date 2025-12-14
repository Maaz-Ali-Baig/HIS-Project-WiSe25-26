import { useMultiCorrelationStore } from '@/store/multiCorrelationStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const CORRELATION_METHODS = {
  'nominal-nominal': [
    { value: 'chi_square', label: 'Chi-Square Test (χ²)' },
    { value: 'phi', label: 'Phi Coefficient (φ)' },
    { value: 'cramers_v', label: "Cramer's V" },
  ],
  'ordinal-ordinal': [
    { value: 'spearman', label: "Spearman's Rho (ρ)" },
    { value: 'kendall_tau_b', label: "Kendall's Tau-b (τb)" },
    { value: 'somers_d', label: "Somers' D" },
    { value: 'pearson_ordinal', label: 'Pearson Correlation on Ordinal Scores' },
  ],
  'nominal-ordinal': [
    { value: 'anova_eta', label: 'ANOVA + Eta Squared (η²)' },
    { value: 'kruskal_wallis', label: 'Kruskal-Wallis + Epsilon Squared (ε²)' },
  ],
};

export function PairTypeMethodSelector() {
  const {
    methodsByPairType,
    setMethodForPairType,
    setCurrentStep,
    analyzeMatrix,
    isLoading,
    selectedColumns,
    variableConfigs,
  } = useMultiCorrelationStore();

  const handleBack = () => {
    setCurrentStep('missing');
  };

  const handleAnalyze = async () => {
    await analyzeMatrix();
  };

  // Determine which pair types are needed
  const isTwoColumnMode = selectedColumns.length === 2;
  const neededPairTypes = new Set<string>();
  
  if (isTwoColumnMode && selectedColumns.length === 2) {
    // For 2 columns, determine the specific pair type
    const [col1, col2] = selectedColumns;
    const type1 = variableConfigs[col1]?.type;
    const type2 = variableConfigs[col2]?.type;
    
    if (type1 && type2) {
      if (type1 === 'nominal' && type2 === 'nominal') {
        neededPairTypes.add('nominal-nominal');
      } else if (type1 === 'ordinal' && type2 === 'ordinal') {
        neededPairTypes.add('ordinal-ordinal');
      } else if (
        (type1 === 'nominal' && type2 === 'ordinal') ||
        (type1 === 'ordinal' && type2 === 'nominal')
      ) {
        neededPairTypes.add('nominal-ordinal');
      }
    }
  } else {
    // For multi-column, show all pair types
    neededPairTypes.add('nominal-nominal');
    neededPairTypes.add('ordinal-ordinal');
    neededPairTypes.add('nominal-ordinal');
  }

  // Check if all needed methods are selected
  const allMethodsSelected = Array.from(neededPairTypes).every(
    (pairType) => methodsByPairType[pairType as keyof typeof methodsByPairType]
  );

  return (
    <Card>
      <CardHeader className="pb-2 py-3">
        <CardTitle>Select Correlation Methods</CardTitle>
        <CardDescription className="text-xs">
          {isTwoColumnMode
            ? 'Choose a correlation method for your selected variables.'
            : 'Choose one method for each pair type. The selected method will be applied to all column pairs of that type.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 py-3">
        {/* Nominal-Nominal */}
        {neededPairTypes.has('nominal-nominal') && (
          <div className="space-y-2 p-4 border rounded-md">
            <Label htmlFor="nominal-nominal" className="font-semibold">
              Nominal vs Nominal
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              {isTwoColumnMode
                ? 'Both variables are nominal (unordered categories)'
                : 'For pairs where both variables are nominal (unordered categories)'}
            </p>
            <Select
              value={methodsByPairType['nominal-nominal'] || ''}
              onValueChange={(value) => setMethodForPairType('nominal-nominal', value)}
            >
              <SelectTrigger id="nominal-nominal">
                <SelectValue placeholder="Select method..." />
              </SelectTrigger>
              <SelectContent>
                {CORRELATION_METHODS['nominal-nominal'].map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Ordinal-Ordinal */}
        {neededPairTypes.has('ordinal-ordinal') && (
          <div className="space-y-2 p-4 border rounded-md">
            <Label htmlFor="ordinal-ordinal" className="font-semibold">
              Ordinal vs Ordinal
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              {isTwoColumnMode
                ? 'Both variables are ordinal (ordered categories)'
                : 'For pairs where both variables are ordinal (ordered categories)'}
            </p>
            <Select
              value={methodsByPairType['ordinal-ordinal'] || ''}
              onValueChange={(value) => setMethodForPairType('ordinal-ordinal', value)}
            >
              <SelectTrigger id="ordinal-ordinal">
                <SelectValue placeholder="Select method..." />
              </SelectTrigger>
              <SelectContent>
                {CORRELATION_METHODS['ordinal-ordinal'].map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Nominal-Ordinal */}
        {neededPairTypes.has('nominal-ordinal') && (
          <div className="space-y-2 p-4 border rounded-md">
            <Label htmlFor="nominal-ordinal" className="font-semibold">
              Nominal vs Ordinal
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              {isTwoColumnMode
                ? 'One variable is nominal and the other is ordinal'
                : 'For pairs where one variable is nominal and the other is ordinal'}
            </p>
            <Select
              value={methodsByPairType['nominal-ordinal'] || ''}
              onValueChange={(value) => setMethodForPairType('nominal-ordinal', value)}
            >
              <SelectTrigger id="nominal-ordinal">
                <SelectValue placeholder="Select method..." />
              </SelectTrigger>
              <SelectContent>
                {CORRELATION_METHODS['nominal-ordinal'].map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={handleBack} disabled={isLoading}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Missing Values
          </Button>
          <Button onClick={handleAnalyze} disabled={!allMethodsSelected || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze Correlations'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
