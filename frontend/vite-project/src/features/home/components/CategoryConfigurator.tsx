import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCorrelationStore } from '@/store/correlationStore';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CategoryConfiguratorProps {
  columnKey: 'col1' | 'col2';
  title: string;
}

export function CategoryConfigurator({ columnKey, title }: CategoryConfiguratorProps) {
  const { variableConfigs, setVariableType, setVariableOrdering } = useCorrelationStore();
  const config = variableConfigs[columnKey];

  const [orderingState, setOrderingState] = useState<Record<string, number>>({});

  useEffect(() => {
    if (config?.ordering) {
      setOrderingState(config.ordering);
    } else if (config?.type === 'ordinal') {
      // Initialize with default ordering (1, 2, 3, ...)
      const defaultOrdering: Record<string, number> = {};
      config.categories.forEach((cat, idx) => {
        defaultOrdering[cat] = idx + 1;
      });
      setOrderingState(defaultOrdering);
      setVariableOrdering(columnKey, defaultOrdering);
    }
  }, [config?.type, config?.categories]);

  if (!config) {
    return null;
  }

  const handleTypeChange = (type: 'nominal' | 'ordinal') => {
    setVariableType(columnKey, type);
    if (type === 'ordinal') {
      // Initialize ordering when switching to ordinal
      const defaultOrdering: Record<string, number> = {};
      config.categories.forEach((cat, idx) => {
        defaultOrdering[cat] = idx + 1;
      });
      setOrderingState(defaultOrdering);
      setVariableOrdering(columnKey, defaultOrdering);
    }
  };

  const handleOrderChange = (category: string, value: string) => {
    const order = parseInt(value, 10);
    if (!isNaN(order) && order > 0) {
      const newOrdering = { ...orderingState, [category]: order };
      setOrderingState(newOrdering);
      setVariableOrdering(columnKey, newOrdering);
    }
  };

  const moveCategory = (category: string, direction: 'up' | 'down') => {
    const currentOrder = orderingState[category];
    const newOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
    
    if (newOrder < 1 || newOrder > config.categories.length) return;

    // Swap with the category at the target position
    const swapCategory = Object.entries(orderingState).find(
      ([_, order]) => order === newOrder
    )?.[0];

    if (swapCategory) {
      const newOrdering = {
        ...orderingState,
        [category]: newOrder,
        [swapCategory]: currentOrder,
      };
      setOrderingState(newOrdering);
      setVariableOrdering(columnKey, newOrdering);
    }
  };

  // Sort categories by order for display
  const sortedCategories = config.type === 'ordinal'
    ? [...config.categories].sort(
        (a, b) => (orderingState[a] || 0) - (orderingState[b] || 0)
      )
    : config.categories;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base font-semibold">
          {title} <span className="text-muted-foreground font-normal">- Feature: {config.columnName}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 py-3">
        {/* Variable Type Selection */}
        <div className="space-y-2">
          <Label>Variable Type</Label>
          <RadioGroup
            value={config.type}
            onValueChange={handleTypeChange}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="nominal" id={`${columnKey}-nominal`} />
              <Label htmlFor={`${columnKey}-nominal`} className="font-normal cursor-pointer">
                Nominal (Categorical)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ordinal" id={`${columnKey}-ordinal`} />
              <Label htmlFor={`${columnKey}-ordinal`} className="font-normal cursor-pointer">
                Ordinal (Ordered)
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Categories Display */}
        <div className="space-y-2">
          <Label>
            Categories ({config.categories.length})
            {config.type === 'ordinal' && (
              <span className="text-sm text-muted-foreground ml-2">
                (Assign order: 1 = lowest, {config.categories.length} = highest)
              </span>
            )}
          </Label>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {config.type === 'nominal' ? (
              // Nominal: Just show badges
              <div className="flex flex-wrap gap-2">
                {config.categories.map((category) => (
                  <Badge key={category} variant="secondary">
                    {category}
                  </Badge>
                ))}
              </div>
            ) : (
              // Ordinal: Show with ordering inputs
              <div className="space-y-2">
                {sortedCategories.map((category) => (
                  <div
                    key={category}
                    className="flex items-center gap-3 p-2 border rounded-md bg-muted/50"
                  >
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => moveCategory(category, 'up')}
                        disabled={orderingState[category] === 1}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => moveCategory(category, 'down')}
                        disabled={orderingState[category] === config.categories.length}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={config.categories.length}
                      value={orderingState[category] || ''}
                      onChange={(e) => handleOrderChange(category, e.target.value)}
                      className="w-16 text-center"
                    />
                    <Badge variant="outline" className="flex-1">
                      {category}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
