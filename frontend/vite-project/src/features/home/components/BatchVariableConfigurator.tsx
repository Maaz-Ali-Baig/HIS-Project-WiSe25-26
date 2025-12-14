import { useState } from 'react';
import { useMultiCorrelationStore } from '@/store/multiCorrelationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Loader2, AlertTriangle } from 'lucide-react';

export function BatchVariableConfigurator() {
  const {
    selectedColumns,
    variableConfigs,
    setVariableType,
    setVariableOrdering,
    setCurrentStep,
    checkMissing,
    isLoading,
    error,
  } = useMultiCorrelationStore();

  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);

  const handleOrderChange = (columnName: string, category: string, value: string) => {
    const order = parseInt(value, 10);
    if (!isNaN(order) && order > 0) {
      const config = variableConfigs[columnName];
      if (config) {
        const newOrdering = { ...config.ordering, [category]: order };
        setVariableOrdering(columnName, newOrdering);
      }
    }
  };

  const moveCategory = (columnName: string, category: string, direction: 'up' | 'down') => {
    const config = variableConfigs[columnName];
    if (!config?.ordering) return;

    const currentOrder = config.ordering[category];
    const newOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;

    if (newOrder < 1 || newOrder > config.categories.length) return;

    // Swap with the category at the target position
    const swapCategory = Object.entries(config.ordering).find(
      ([_, order]) => order === newOrder
    )?.[0];

    if (swapCategory) {
      const newOrdering = {
        ...config.ordering,
        [category]: newOrder,
        [swapCategory]: currentOrder,
      };
      setVariableOrdering(columnName, newOrdering);
    }
  };

  const getSortedCategories = (columnName: string) => {
    const config = variableConfigs[columnName];
    if (!config) return [];

    if (config.type === 'ordinal' && config.ordering) {
      return [...config.categories].sort(
        (a, b) => (config.ordering![a] || 0) - (config.ordering![b] || 0)
      );
    }
    return config.categories;
  };

  const handleContinue = async () => {
    try {
      await checkMissing();
    } catch (err) {
      console.error('Error in handleContinue:', err);
    }
  };

  const handleBack = () => {
    setCurrentStep('select');
  };

  return (
    <div className="space-y-3">
      {selectedColumns.map((columnName, idx) => {
        const config = variableConfigs[columnName];
        if (!config) return null;

        const isExpanded = expandedColumn === columnName;
        const sortedCategories = getSortedCategories(columnName);

        return (
          <Card key={columnName}>
            <CardHeader className="pb-2 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                    {idx + 1}
                  </div>
                  <CardTitle className="text-base">{columnName}</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs">
                  {config.categories.length} categories
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 py-3">
              {/* Variable Type Selection */}
              <div className="space-y-2">
                <Label>Variable Type</Label>
                <RadioGroup
                  value={config.type}
                  onValueChange={(value) => setVariableType(columnName, value as 'nominal' | 'ordinal')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nominal" id={`${columnName}-nominal`} />
                    <Label htmlFor={`${columnName}-nominal`} className="font-normal cursor-pointer text-sm">
                      Nominal (Categorical)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ordinal" id={`${columnName}-ordinal`} />
                    <Label htmlFor={`${columnName}-ordinal`} className="font-normal cursor-pointer text-sm">
                      Ordinal (Ordered)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Categories Display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">
                    Categories
                    {config.type === 'ordinal' && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (1 = lowest, {config.categories.length} = highest)
                      </span>
                    )}
                  </Label>
                  {config.categories.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedColumn(isExpanded ? null : columnName)}
                      className="h-7 text-xs"
                    >
                      {isExpanded ? 'Show less' : 'Show all'}
                    </Button>
                  )}
                </div>

                {config.type === 'nominal' ? (
                  // Nominal: Just show badges
                  <div className="flex flex-wrap gap-2">
                    {(isExpanded ? config.categories : config.categories.slice(0, 5)).map((category) => (
                      <Badge key={category} variant="secondary" className="text-xs">
                        {category}
                      </Badge>
                    ))}
                    {!isExpanded && config.categories.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{config.categories.length - 5} more
                      </Badge>
                    )}
                  </div>
                ) : (
                  // Ordinal: Show with ordering
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {(isExpanded ? sortedCategories : sortedCategories.slice(0, 5)).map((category) => (
                      <div
                        key={category}
                        className="flex items-center gap-2 p-2 border rounded-md bg-muted/50"
                      >
                        <Input
                          type="number"
                          min="1"
                          max={config.categories.length}
                          value={config.ordering?.[category] || ''}
                          onChange={(e) => handleOrderChange(columnName, category, e.target.value)}
                          className="w-16 h-8 text-sm"
                        />
                        <span className="flex-1 text-sm">{category}</span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveCategory(columnName, category, 'up')}
                            disabled={config.ordering?.[category] === 1}
                            className="h-7 w-7 p-0"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveCategory(columnName, category, 'down')}
                            disabled={config.ordering?.[category] === config.categories.length}
                            className="h-7 w-7 p-0"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {!isExpanded && sortedCategories.length > 5 && (
                      <div className="text-xs text-muted-foreground text-center py-1">
                        +{sortedCategories.length - 5} more categories
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={handleBack} disabled={isLoading}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Selection
        </Button>
        <Button onClick={handleContinue} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              Continue to Missing Values
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
