// frontend/src/components/ColumnSelectionPanel.tsx
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Slider } from './ui/slider';
import { X, Plus, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Input } from './ui/input';

interface ColumnRange {
  id: string;
  start: number; // 0-based
  end: number;   // 0-based, inclusive
}

interface ColumnSelectionPanelProps {
  totalColumns: number;
  currentRanges: Array<{ start: number; end: number }>;
  onApply: (ranges: Array<{ start: number; end: number }>) => void;
  onReset: () => void;
  isLoading?: boolean;
}

export function ColumnSelectionPanel({
  totalColumns,
  currentRanges,
  onApply,
  onReset,
  isLoading = false,
}: ColumnSelectionPanelProps) {
  const [ranges, setRanges] = useState<ColumnRange[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // First / Last N values
  const [firstN, setFirstN] = useState<string>('');
  const [lastN, setLastN] = useState<string>('');

  // NEW: error only for First N / Last N
  const [firstLastError, setFirstLastError] = useState<string | null>(null);

  // manual text values for From/To
  const [manualInputs, setManualInputs] = useState<
    Record<string, { start: string; end: string }>
  >({});

  const syncManualInputs = (rangesToSync: ColumnRange[]) => {
    const next: Record<string, { start: string; end: string }> = {};
    for (const r of rangesToSync) {
      next[r.id] = {
        start: String(r.start + 1),
        end: String(r.end + 1),
      };
    }
    setManualInputs(next);
  };

  // Initialize ranges from props or create default range
  useEffect(() => {
    let nextRanges: ColumnRange[] = [];
    if (currentRanges && currentRanges.length > 0) {
      nextRanges = currentRanges.map((r, idx) => ({
        id: `range-${idx}`,
        start: r.start,
        end: r.end,
      }));
    } else if (totalColumns > 0) {
      nextRanges = [
        {
          id: 'range-0',
          start: 0,
          end: totalColumns - 1,
        },
      ];
    }
    setRanges(nextRanges);
    syncManualInputs(nextRanges);
  }, [currentRanges, totalColumns]);

  const validateRanges = (rangesToValidate: ColumnRange[]): boolean => {
    if (rangesToValidate.length === 0) {
      setValidationError(null);
      return true; // Empty means select all
    }

    const sorted = [...rangesToValidate].sort((a, b) => a.start - b.start);

    // Overlap check
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].end >= sorted[i + 1].start) {
        setValidationError(
          `Ranges overlap: columns ${sorted[i].start + 1}-${sorted[i].end + 1} and ${
            sorted[i + 1].start + 1
          }-${sorted[i + 1].end + 1}`
        );
        return false;
      }
    }

    // Bounds check
    for (const range of rangesToValidate) {
      if (range.start < 0 || range.end >= totalColumns || range.start > range.end) {
        setValidationError(`Invalid range: ${range.start + 1}-${range.end + 1}`);
        return false;
      }
    }

    setValidationError(null);
    return true;
  };

  const clampIndex = (v: number) => {
    if (Number.isNaN(v)) return 0;
    if (v < 0) return 0;
    if (v > totalColumns - 1) return totalColumns - 1;
    return v;
  };

  // -------- First N / Last N handlers --------

  const handleApplyFirstN = () => {
    if (totalColumns === 0) return;

    const n = Number(firstN);

    if (Number.isNaN(n) || n < 1) {
      setFirstLastError('Enter a valid positive number for First N Columns.');
      return;
    }
    if (n > totalColumns) {
      setFirstLastError(
        `First N Columns cannot be more than total columns (${totalColumns}).`
      );
      return;
    }

    setFirstLastError(null);

    const newRanges: ColumnRange[] = [{ id: 'first-n', start: 0, end: n - 1 }];

    if (!validateRanges(newRanges)) return;
    setRanges(newRanges);
    syncManualInputs(newRanges);
    onApply(newRanges.map((r) => ({ start: r.start, end: r.end })));
  };

  const handleApplyLastN = () => {
    if (totalColumns === 0) return;

    const n = Number(lastN);

    if (Number.isNaN(n) || n < 1) {
      setFirstLastError('Enter a valid positive number for Last N Columns.');
      return;
    }
    if (n > totalColumns) {
      setFirstLastError(
        `Last N Columns cannot be more than total columns (${totalColumns}).`
      );
      return;
    }

    setFirstLastError(null);

    const start = Math.max(0, totalColumns - n);
    const newRanges: ColumnRange[] = [
      { id: 'last-n', start, end: totalColumns - 1 },
    ];

    if (!validateRanges(newRanges)) return;
    setRanges(newRanges);
    syncManualInputs(newRanges);
    onApply(newRanges.map((r) => ({ start: r.start, end: r.end })));
  };

  // -------- Slider + manual range handlers --------

  const handleRangeChange = (rangeId: string, values: number[]) => {
    const newRanges = ranges.map((r) =>
      r.id === rangeId ? { ...r, start: values[0], end: values[1] } : r
    );
    setRanges(newRanges);
    syncManualInputs(newRanges);
    validateRanges(newRanges);
  };

  const handleManualInputChange = (
    rangeId: string,
    field: 'start' | 'end',
    value: string
  ) => {
    setManualInputs((prev) => {
      const current = prev[rangeId] ?? {
        start: '',
        end: '',
      };
      return {
        ...prev,
        [rangeId]: {
          ...current,
          [field]: value,
        },
      };
    });

    if (value === '') {
      return;
    }

    const oneBased = Number(value);
    if (Number.isNaN(oneBased)) return;

    const zeroBased = clampIndex(oneBased - 1);

    const newRanges = ranges.map((r) =>
      r.id === rangeId ? { ...r, [field]: zeroBased } : r
    );
    setRanges(newRanges);
    validateRanges(newRanges);
  };

  const handleAddRange = () => {
    const lastRange = ranges[ranges.length - 1];
    const newStart = lastRange ? Math.min(lastRange.end + 1, totalColumns - 1) : 0;
    const newEnd = totalColumns - 1;

    const newRange: ColumnRange = {
      id: `range-${Date.now()}`,
      start: newStart,
      end: newEnd,
    };

    const newRanges = [...ranges, newRange];
    setRanges(newRanges);
    syncManualInputs(newRanges);
    validateRanges(newRanges);
  };

  const handleRemoveRange = (rangeId: string) => {
    const newRanges = ranges.filter((r) => r.id !== rangeId);
    setRanges(newRanges);
    syncManualInputs(newRanges);
    validateRanges(newRanges);
  };

  const handleApply = () => {
    if (!validateRanges(ranges)) return;

    const apiRanges = ranges.map((r) => ({
      start: r.start,
      end: r.end,
    }));
    onApply(apiRanges);
  };

  const handleReset = () => {
    onReset();
  };

  const canAddRange = ranges.length < totalColumns && ranges.length < 10;
  const isValid = validationError === null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Column Selection</CardTitle>
        <CardDescription>
          Select column ranges to display in the table. Ranges are shown in 1-based column
          numbers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* First / Last N columns – at the top */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">First N Columns</label>
            <Input
              type="number"
              min={1}
              max={totalColumns}
              value={firstN}
              onChange={(e) => {
                setFirstN(e.target.value);
                setFirstLastError(null);
              }}
              placeholder="e.g. 5"
              className="h-9"
            />
            <Button
              onClick={handleApplyFirstN}
              disabled={isLoading || totalColumns === 0}
              className="w-full bg-black text-white hover:bg-black/90"
            >
              Apply
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Last N Columns</label>
            <Input
              type="number"
              min={1}
              max={totalColumns}
              value={lastN}
              onChange={(e) => {
                setLastN(e.target.value);
                setFirstLastError(null);
              }}
              placeholder="e.g. 5"
              className="h-9"
            />
            <Button
              onClick={handleApplyLastN}
              disabled={isLoading || totalColumns === 0}
              className="w-full bg-black text-white hover:bg-black/90"
            >
              Apply
            </Button>
          </div>
        </div>

        {/* NEW: error only for First/Last N */}
        {firstLastError && (
          <Alert variant="destructive">
            <AlertDescription>{firstLastError}</AlertDescription>
          </Alert>
        )}

        {validationError && (
          <Alert variant="destructive">
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        {/* Slider + manual per-range controls */}
        <div className="space-y-4">
          {ranges.map((range, idx) => {
            const inputs = manualInputs[range.id] ?? {
              start: String(range.start + 1),
              end: String(range.end + 1),
            };

            return (
              <div key={range.id} className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Range {idx + 1}: Columns {range.start + 1} - {range.end + 1}
                  </span>
                  {ranges.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRange(range.id)}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
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

                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-600">From</span>
                    <Input
                      type="number"
                      min={1}
                      max={totalColumns}
                      value={inputs.start}
                      onChange={(e) =>
                        handleManualInputChange(range.id, 'start', e.target.value)
                      }
                      className="h-8 w-20 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-600">To</span>
                    <Input
                      type="number"
                      min={1}
                      max={totalColumns}
                      value={inputs.end}
                      onChange={(e) =>
                        handleManualInputChange(range.id, 'end', e.target.value)
                      }
                      className="h-8 w-20 text-xs"
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    (Current: {range.start + 1} – {range.end + 1})
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddRange}
            disabled={!canAddRange || isLoading}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Range
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isLoading}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to All
          </Button>
        </div>

        <div className="flex gap-2 border-t pt-2">
          <Button
            onClick={handleApply}
            disabled={!isValid || isLoading}
            className="w-full"
          >
            {isLoading ? 'Applying...' : 'Apply Selection'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Total columns: {totalColumns} | Selected ranges: {ranges.length}
        </p>
      </CardContent>
    </Card>
  );
}
