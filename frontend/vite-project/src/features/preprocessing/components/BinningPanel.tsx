import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "sonner";

interface BinningPanelProps {
  columns: string[];
  userId: string;
  fileId: string;
  onSuccess?: () => void;
}

type BinningMethod =
  | "equal-width"
  | "equal-freq"
  | "smooth-mean"
  | "smooth-median"
  | "quantile"
  | "custom";

export function BinningPanel({
  columns,
  userId,
  fileId,
  onSuccess,
}: BinningPanelProps) {
  const [selectedMethod, setSelectedMethod] =
    useState<BinningMethod>("equal-width");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [nBins, setNBins] = useState<number>(5);
  const [isLoading, setIsLoading] = useState(false);

  // Filter out 'id' column from selectable columns
  const selectableColumns = columns.filter((col) => col !== "id");

  const methods: Array<{ value: BinningMethod; label: string; description: string }> = [
    {
      value: "equal-width",
      label: "Equal Width",
      description: "Divide range into equal-sized bins",
    },
    {
      value: "equal-freq",
      label: "Equal Frequency",
      description: "Create bins with equal number of observations",
    },
    {
      value: "smooth-mean",
      label: "Smooth Mean",
      description: "Smooth data using moving average before binning",
    },
    {
      value: "smooth-median",
      label: "Smooth Median",
      description: "Smooth data using moving median before binning",
    },
    {
      value: "quantile",
      label: "Quantile",
      description: "Create bins based on quantile boundaries",
    },
    {
      value: "custom",
      label: "Custom",
      description: "Specify custom break points",
    },
  ];

  const handleApply = async () => {
    if (selectedColumns.length === 0) {
      toast.error("No columns selected", {
        description:
          "Please select at least one column to apply binning.",
      });
      return;
    }

    if (nBins < 1 || nBins > 20) {
      toast.error("Invalid number of bins", {
        description: "Number of bins must be between 1 and 20.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { handleBinning } = await import("../../home/api/uploads");

      await handleBinning({
        userId,
        fileId,
        selected_columns: selectedColumns,
        method: selectedMethod,
        n_bins: nBins,
      });

      toast.success("Success", {
        description: `Binning applied successfully using ${methods.find((m) => m.value === selectedMethod)?.label}.`,
      });

      // Trigger refresh
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error("Failed to apply binning", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Method Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Binning Method</Label>
        <div className="space-y-0.5">
          {methods.map((method) => (
            <label
              key={method.value}
              className="flex items-center gap-2.5 cursor-pointer hover:bg-accent/50 px-3 py-1.5 rounded-md transition-colors"
              title={method.description}
            >
              <input
                type="radio"
                name="binning-method"
                value={method.value}
                checked={selectedMethod === method.value}
                onChange={() => setSelectedMethod(method.value)}
                className="h-4 w-4 accent-primary cursor-pointer"
              />
              <span className="text-sm">{method.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Number of Bins */}
      {selectedMethod !== "custom" && (
        <div className="space-y-2">
          <Label htmlFor="n-bins" className="text-sm font-medium">
            Number of Bins
          </Label>
          <Input
            id="n-bins"
            type="number"
            min={1}
            max={20}
            value={nBins}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!isNaN(value)) {
                setNBins(value);
              }
            }}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Enter a value between 1 and 20
          </p>
        </div>
      )}

      {/* Column Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Select Columns</Label>
          {selectedColumns.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedColumns([])}
              className="h-7 px-2 text-xs"
            >
              Clear all
            </Button>
          )}
        </div>

        <MultiSelect
          options={selectableColumns}
          value={selectedColumns}
          onChange={setSelectedColumns}
          placeholder="Search columns..."
        />

        {selectedColumns.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedColumns.length} column
            {selectedColumns.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      {/* Apply Button */}
      <Button
        onClick={handleApply}
        disabled={selectedColumns.length === 0 || isLoading}
        className="w-full"
        size="sm"
      >
        {isLoading ? "Applying..." : "Apply Binning"}
      </Button>
    </div>
  );
}
