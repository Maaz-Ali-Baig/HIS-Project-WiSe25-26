import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useCorrelationStore } from '@/store/correlationStore';
import { getAvailableMethods } from '../api/correlation';
import { Info } from 'lucide-react';

export function MethodSelector() {
  const {
    variableConfigs,
    availableMethods,
    selectedMethod,
    setAvailableMethods,
    setSelectedMethod,
  } = useCorrelationStore();

  const config1 = variableConfigs.col1;
  const config2 = variableConfigs.col2;

  // Fetch available methods when both variable types are set
  useEffect(() => {
    const fetchMethods = async () => {
      if (config1 && config2) {
        try {
          const response = await getAvailableMethods(config1.type, config2.type);
          setAvailableMethods(response.methods);
          // Reset selected method when types change
          if (selectedMethod && !response.methods.find(m => m.value === selectedMethod)) {
            setSelectedMethod(response.methods[0]?.value || '');
          }
        } catch (error) {
          console.error('Error fetching methods:', error);
        }
      }
    };

    fetchMethods();
  }, [config1?.type, config2?.type]);

  if (!config1 || !config2) {
    return null;
  }

  const selectedMethodInfo = availableMethods.find((m) => m.value === selectedMethod);

  return (
    <Card>
      <CardContent className="space-y-2 py-3">
        <div className="space-y-2">
          <Label htmlFor="method">Analysis Method</Label>
          <Select value={selectedMethod || ''} onValueChange={setSelectedMethod}>
            <SelectTrigger id="method">
              <SelectValue placeholder="Choose correlation method" />
            </SelectTrigger>
            <SelectContent>
              {availableMethods.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  {method.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedMethodInfo && (
          <div className="flex gap-2 p-3 bg-muted rounded-md">
            <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              {selectedMethodInfo.description}
            </p>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <p>
            <strong>Variable 1:</strong> {config1.columnName} ({config1.type})
          </p>
          <p>
            <strong>Variable 2:</strong> {config2.columnName} ({config2.type})
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
