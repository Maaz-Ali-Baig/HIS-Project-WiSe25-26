import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCorrelationStore } from '@/store/correlationStore';
import { ArrowUp, ArrowDown, Hash, ListOrdered, Grid3x3, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface CategoryConfiguratorProps {
  columnKey: 'col1' | 'col2';
  title: string;
}

export function CategoryConfigurator({ columnKey, title }: CategoryConfiguratorProps) {
  const { variable1Config, variable2Config, setVariable1Config, setVariable2Config } = useCorrelationStore();
  
  // Map columnKey to the correct config and setter
  const config = columnKey === 'col1' ? variable1Config : variable2Config;
  const setConfig = columnKey === 'col1' ? setVariable1Config : setVariable2Config;

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
      // Update the config with the default ordering
      setConfig({ ...config, ordering: defaultOrdering });
    }
  }, [config?.type, config?.categories, config, setConfig]);

  if (!config) {
    return null;
  }

  const handleTypeChange = (type: 'nominal' | 'ordinal') => {
    if (!config) return;
    
    setConfig({ ...config, type });
    
    if (type === 'ordinal') {
      // Initialize ordering when switching to ordinal
      const defaultOrdering: Record<string, number> = {};
      config.categories.forEach((cat, idx) => {
        defaultOrdering[cat] = idx + 1;
      });
      setOrderingState(defaultOrdering);
      setConfig({ ...config, type, ordering: defaultOrdering });
    } else {
      // Remove ordering when switching to nominal
      setConfig({ ...config, type, ordering: undefined });
    }
  };

  const handleOrderChange = (category: string, value: string) => {
    if (!config) return;
    
    const order = parseInt(value, 10);
    if (!isNaN(order) && order > 0) {
      const newOrdering = { ...orderingState, [category]: order };
      setOrderingState(newOrdering);
      setConfig({ ...config, ordering: newOrdering });
    }
  };

  const moveCategory = (category: string, direction: 'up' | 'down') => {
    if (!config) return;
    
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
      setConfig({ ...config, ordering: newOrdering });
    }
  };

  // Sort categories by order for display
  const sortedCategories = config.type === 'ordinal'
    ? [...config.categories].sort(
        (a, b) => (orderingState[a] || 0) - (orderingState[b] || 0)
      )
    : config.categories;

  return (
    <Card className="border-2 hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3 bg-gradient-to-r from-muted/50 to-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              {columnKey === 'col1' ? (
                <span className="text-sm font-bold text-primary">1</span>
              ) : (
                <span className="text-sm font-bold text-primary">2</span>
              )}
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {config.columnName}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            <Hash className="h-3 w-3 mr-1" />
            {config.categories.length} categories
          </Badge>
        </div>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="space-y-4 pt-4">
        {/* Variable Type Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-semibold">Variable Type</Label>
          </div>
          <RadioGroup
            value={config.type}
            onValueChange={handleTypeChange}
            className="grid grid-cols-2 gap-3"
          >
            <div 
              className={`
                relative flex items-center space-x-3 border-2 rounded-lg p-3 cursor-pointer transition-all
                ${config.type === 'nominal' 
                  ? 'border-primary bg-primary/5 shadow-sm' 
                  : 'border-border hover:border-primary/30 hover:bg-muted/50'
                }
              `}
            >
              <RadioGroupItem value="nominal" id={`${columnKey}-nominal`} className="mt-0" />
              <Label 
                htmlFor={`${columnKey}-nominal`} 
                className="font-normal cursor-pointer flex-1 text-sm"
              >
                <div className="font-medium">Nominal</div>
                <div className="text-xs text-muted-foreground">No inherent order</div>
              </Label>
              {config.type === 'nominal' && (
                <Grid3x3 className="h-4 w-4 text-primary" />
              )}
            </div>
            <div 
              className={`
                relative flex items-center space-x-3 border-2 rounded-lg p-3 cursor-pointer transition-all
                ${config.type === 'ordinal' 
                  ? 'border-primary bg-primary/5 shadow-sm' 
                  : 'border-border hover:border-primary/30 hover:bg-muted/50'
                }
              `}
            >
              <RadioGroupItem value="ordinal" id={`${columnKey}-ordinal`} className="mt-0" />
              <Label 
                htmlFor={`${columnKey}-ordinal`} 
                className="font-normal cursor-pointer flex-1 text-sm"
              >
                <div className="font-medium">Ordinal</div>
                <div className="text-xs text-muted-foreground">Ranked order</div>
              </Label>
              {config.type === 'ordinal' && (
                <ListOrdered className="h-4 w-4 text-primary" />
              )}
            </div>
          </RadioGroup>
        </div>

        <Separator />

        {/* Categories Display */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Grid3x3 className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Categories</Label>
            </div>
            {config.type === 'ordinal' && (
              <span className="text-xs text-muted-foreground italic">
                1 = lowest • {config.categories.length} = highest
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin">
            {config.type === 'nominal' ? (
              // Nominal: Grid layout with cards
              <div className="grid grid-cols-2 gap-2">
                {config.categories.map((category, idx) => (
                  <div 
                    key={category}
                    className="group relative flex items-center gap-2 p-2.5 border rounded-lg bg-card hover:bg-muted/50 hover:border-primary/50 transition-all"
                  >
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-muted-foreground font-medium">
                        {idx + 1}
                      </span>
                    </div>
                    <span className="text-sm truncate flex-1" title={category}>
                      {category}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              // Ordinal: List with ranking controls
              <div className="space-y-1.5">
                {sortedCategories.map((category) => (
                  <div
                    key={category}
                    className="group flex items-center gap-2.5 p-2.5 border rounded-lg bg-card hover:bg-muted/30 transition-all"
                  >
                    {/* Rank Badge */}
                    <div className="relative flex-shrink-0">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {orderingState[category]}
                        </span>
                      </div>
                    </div>
                    
                    {/* Arrow Controls */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 hover:bg-primary/10"
                        onClick={() => moveCategory(category, 'up')}
                        disabled={orderingState[category] === 1}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 hover:bg-primary/10"
                        onClick={() => moveCategory(category, 'down')}
                        disabled={orderingState[category] === config.categories.length}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {/* Manual Input */}
                    <Input
                      type="number"
                      min={1}
                      max={config.categories.length}
                      value={orderingState[category] || ''}
                      onChange={(e) => handleOrderChange(category, e.target.value)}
                      className="w-14 h-8 text-center text-xs border-dashed"
                      title="Manual rank entry"
                    />
                    
                    {/* Category Name */}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate font-medium" title={category}>
                        {category}
                      </span>
                    </div>
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
