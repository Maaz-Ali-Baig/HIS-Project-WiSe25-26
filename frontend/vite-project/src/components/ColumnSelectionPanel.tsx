import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { X, Plus, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";

interface ColumnRange {
  id: string;
  start: number;
  end: number;
}

export type ColumnTypeFilter = "all" | "categorical" | "numeric";

interface ColumnSelectionPanelProps {
  totalColumns: number;
  currentRanges: Array<{ start: number; end: number }>;
  currentColumnTypeFilter?: ColumnTypeFilter;
  onApply: (ranges: Array<{ start: number; end: number }>, columnTypeFilter: ColumnTypeFilter) => void;
  onReset: () => void;
  isLoading?: boolean;
}

export function ColumnSelectionPanel({
  totalColumns,
  currentRanges,
  currentColumnTypeFilter = "all",
  onApply,
  onReset,
  isLoading = false,
}: ColumnSelectionPanelProps) {
  const [ranges, setRanges] = useState<ColumnRange[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [columnTypeFilter, setColumnTypeFilter] = useState<ColumnTypeFilter>(currentColumnTypeFilter);

  // Initialize ranges from props or create default range
  useEffect(() => {
    if (currentRanges && currentRanges.length > 0) {
      setRanges(
        currentRanges.map((r, idx) => ({
          id: `range-${idx}`,
          start: r.start,
          end: r.end,
        })),
      );
    } else {
      // Default: single range covering all columns
      setRanges([
        {
          id: "range-0",
          start: 0,
          end: totalColumns - 1,
        },
      ]);
    }
  }, [currentRanges, totalColumns]);

  // Update columnTypeFilter when prop changes
  useEffect(() => {
    setColumnTypeFilter(currentColumnTypeFilter);
  }, [currentColumnTypeFilter]);

  const validateRanges = (rangesToValidate: ColumnRange[]): boolean => {
    if (rangesToValidate.length === 0) {
      setValidationError(null);
      return true; // Empty means select all
    }

    // Sort ranges by start for overlap check
    const sorted = [...rangesToValidate].sort((a, b) => a.start - b.start);

    // Check for overlaps
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].end >= sorted[i + 1].start) {
        setValidationError(
          `Ranges overlap: columns ${sorted[i].start + 1}-${sorted[i].end + 1} and ${sorted[i + 1].start + 1}-${sorted[i + 1].end + 1}`,
        );
        return false;
      }
    }

    // Check bounds
    for (const range of rangesToValidate) {
      if (
        range.start < 0 ||
        range.end >= totalColumns ||
        range.start > range.end
      ) {
        setValidationError(
          `Invalid range: ${range.start + 1}-${range.end + 1}`,
        );
        return false;
      }
    }

    setValidationError(null);
    return true;
  };

  const handleRangeChange = (rangeId: string, values: number[]) => {
    const newRanges = ranges.map((r) =>
      r.id === rangeId ? { ...r, start: values[0], end: values[1] } : r,
    );
    setRanges(newRanges);
    validateRanges(newRanges);
  };

  const handleStartChange = (rangeId: string, value: string) => {
    // Allow empty string for deletion
    if (value === "") {
      return;
    }
    
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;
    
    // Convert from 1-based to 0-based, clamp to valid range
    const zeroBasedValue = Math.max(0, Math.min(numValue - 1, totalColumns - 1));
    
    const newRanges = ranges.map((r) => {
      if (r.id === rangeId) {
        // Ensure start doesn't exceed end
        return { ...r, start: Math.min(zeroBasedValue, r.end) };
      }
      return r;
    });
    setRanges(newRanges);
    validateRanges(newRanges);
  };

  const handleEndChange = (rangeId: string, value: string) => {
    // Allow empty string for deletion
    if (value === "") {
      return;
    }
    
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;
    
    // Convert from 1-based to 0-based, clamp to valid range
    const zeroBasedValue = Math.max(0, Math.min(numValue - 1, totalColumns - 1));
    
    const newRanges = ranges.map((r) => {
      if (r.id === rangeId) {
        // Ensure end doesn't go below start
        return { ...r, end: Math.max(zeroBasedValue, r.start) };
      }
      return r;
    });
    setRanges(newRanges);
    validateRanges(newRanges);
  };

  const handleAddRange = () => {
    const lastRange = ranges[ranges.length - 1];
    const newStart = lastRange
      ? Math.min(lastRange.end + 1, totalColumns - 1)
      : 0;
    const newEnd = totalColumns - 1;

    const newRange: ColumnRange = {
      id: `range-${Date.now()}`,
      start: newStart,
      end: newEnd,
    };

    const newRanges = [...ranges, newRange];
    setRanges(newRanges);
    validateRanges(newRanges);
  };

  const handleRemoveRange = (rangeId: string) => {
    const newRanges = ranges.filter((r) => r.id !== rangeId);
    setRanges(newRanges);
    validateRanges(newRanges);
  };

  const handleApply = () => {
    if (!validateRanges(ranges)) {
      return;
    }

    // Convert to API format (zero-based, inclusive)
    const apiRanges = ranges.map((r) => ({
      start: r.start,
      end: r.end,
    }));

    onApply(apiRanges, columnTypeFilter);
  };

  const handleReset = () => {
    onReset();
  };

  const canAddRange = ranges.length < totalColumns && ranges.length < 10;
  const isValid = validationError === null;

  return (
    <div className="space-y-4">
      {validationError && (
        <Alert variant="destructive">
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {ranges.map((range, idx) => (
          <div key={range.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                Range {idx + 1}: Col {range.start + 1}-{range.end + 1}
              </span>
              {ranges.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveRange(range.id)}
                  disabled={isLoading}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 flex-1">
                <Input
                  type="number"
                  min={1}
                  max={totalColumns}
                  defaultValue={range.start + 1}
                  key={`start-${range.id}-${range.start}`}
                  onBlur={(e) => handleStartChange(range.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleStartChange(range.id, e.currentTarget.value);
                    }
                  }}
                  disabled={isLoading}
                  className="h-7 text-xs text-center"
                />
                <span className="text-xs text-muted-foreground">-</span>
                <Input
                  type="number"
                  min={1}
                  max={totalColumns}
                  defaultValue={range.end + 1}
                  key={`end-${range.id}-${range.end}`}
                  onBlur={(e) => handleEndChange(range.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleEndChange(range.id, e.currentTarget.value);
                    }
                  }}
                  disabled={isLoading}
                  className="h-7 text-xs text-center"
                />
              </div>
            </div>
            
            <Slider
              min={0}
              max={totalColumns - 1}
              step={1}
              value={[range.start, range.end]}
              onValueChange={(values) => handleRangeChange(range.id, values)}
              disabled={isLoading}
              className="w-full"
              minStepsBetweenThumbs={0}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddRange}
          disabled={!canAddRange || isLoading}
          className="flex-1 text-xs h-8"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={isLoading}
          className="flex-1 text-xs h-8"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      {/* Column Type Filter */}
      <div className="pt-3 border-t space-y-2">
        <Label className="text-xs font-medium">Filter Column Types</Label>
        <RadioGroup
          value={columnTypeFilter}
          onValueChange={(value) => setColumnTypeFilter(value as ColumnTypeFilter)}
          disabled={isLoading}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="filter-all" />
            <Label htmlFor="filter-all" className="text-xs font-normal cursor-pointer">
              All Columns (Categorical + Numeric)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="categorical" id="filter-categorical" />
            <Label htmlFor="filter-categorical" className="text-xs font-normal cursor-pointer">
              Categorical Only
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="numeric" id="filter-numeric" />
            <Label htmlFor="filter-numeric" className="text-xs font-normal cursor-pointer">
              Numeric Only
            </Label>
          </div>
        </RadioGroup>
        <p className="text-[10px] text-muted-foreground leading-tight">
          This filter will be applied to all selected columns for preprocessing, correlation analysis, visualization, and report generation.
        </p>
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Button
          onClick={handleApply}
          disabled={!isValid || isLoading}
          className="w-full text-xs h-8"
        >
          {isLoading ? "Applying..." : "Apply"}
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground leading-tight">
        {totalColumns} cols • {ranges.length} range
        {ranges.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
