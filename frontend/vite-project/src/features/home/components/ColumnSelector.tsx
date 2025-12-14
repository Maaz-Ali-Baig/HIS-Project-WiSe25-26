import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCorrelationStore } from '@/store/correlationStore';

export function ColumnSelector() {
  const {
    selectedColumns,
    availableColumns,
    setSelectedColumn,
  } = useCorrelationStore();

  // Filter out already selected column from the other dropdown
  const getAvailableColumnsFor = (columnKey: 'col1' | 'col2') => {
    const otherKey = columnKey === 'col1' ? 'col2' : 'col1';
    const otherSelected = selectedColumns[otherKey];
    return availableColumns.filter((col) => col !== otherSelected);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Select Columns for Analysis</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose two columns from your selected dataset to analyze their correlation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column 1 Selection */}
        <div className="space-y-2">
          <Label htmlFor="column1">Variable 1</Label>
          <Select
            value={selectedColumns.col1 || ''}
            onValueChange={(value: string) => setSelectedColumn('col1', value)}
          >
            <SelectTrigger id="column1">
              <SelectValue placeholder="Select first column" />
            </SelectTrigger>
            <SelectContent>
              {getAvailableColumnsFor('col1').map((column) => (
                <SelectItem key={column} value={column}>
                  {column}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Column 2 Selection */}
        <div className="space-y-2">
          <Label htmlFor="column2">Variable 2</Label>
          <Select
            value={selectedColumns.col2 || ''}
            onValueChange={(value: string) => setSelectedColumn('col2', value)}
          >
            <SelectTrigger id="column2">
              <SelectValue placeholder="Select second column" />
            </SelectTrigger>
            <SelectContent>
              {getAvailableColumnsFor('col2').map((column) => (
                <SelectItem key={column} value={column}>
                  {column}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
