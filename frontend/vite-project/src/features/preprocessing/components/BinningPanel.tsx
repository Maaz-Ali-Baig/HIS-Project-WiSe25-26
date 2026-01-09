import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CustomMappingBuilder } from "./CustomMappingBuilder";

interface BinningPanelProps {
  columns: string[];
  userId: string;
  fileId: string;
  onSuccess?: () => void;
}

type BinningMethod =
  | "frequency"
  | "target-based"
  | "similarity"
  | "domain"
  | "custom";

export function BinningPanel({
  columns,
  userId,
  fileId,
  onSuccess,
}: BinningPanelProps) {
  const [selectedMethod, setSelectedMethod] =
    useState<BinningMethod>("frequency");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [nBins, setNBins] = useState<number | "">(5);
  const [minFreq, setMinFreq] = useState<number>(10);
  const [targetColumn, setTargetColumn] = useState<string>("");
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.7);
  const [customMapping, setCustomMapping] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Filter out 'id' column from selectable columns
  const selectableColumns = columns.filter((col) => col !== "id");

  const methods: Array<{ value: BinningMethod; label: string; description: string }> = [
    {
      value: "frequency",
      label: "Frequency-Based",
      description: "Keep top N categories, group others as 'Other'",
    },
    {
      value: "target-based",
      label: "Target-Based",
      description: "Group categories by their relationship to a target variable",
    },
    {
      value: "similarity",
      label: "Similarity-Based",
      description: "Group categories with similar text patterns",
    },
    {
      value: "domain",
      label: "Domain Knowledge",
      description: "Apply predefined groupings (education, income, age, etc.)",
    },
    {
      value: "custom",
      label: "Custom Mapping",
      description: "Define your own category groupings",
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

    // Validate nBins only for methods that use it (not similarity-based or custom)
    if (selectedMethod !== "similarity" && selectedMethod !== "custom") {
      const bins = typeof nBins === "number" ? nBins : parseInt(String(nBins), 10);
      if (nBins === "" || isNaN(bins) || bins < 1 || bins > 50) {
        toast.error("Invalid number of bins", {
          description: "Number of bins must be between 1 and 50.",
        });
        return;
      }
    }

    // Validate target column for target-based method
    if (selectedMethod === "target-based" && !targetColumn) {
      toast.error("Target column required", {
        description: "Please select a target column for target-based binning.",
      });
      return;
    }

    // Validate custom mapping for custom method
    if (selectedMethod === "custom") {
      if (Object.keys(customMapping).length === 0) {
        toast.error("Custom mapping required", {
          description: "Please create at least one group and assign categories to it.",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      const { handleBinning } = await import("../../home/api/uploads");

      await handleBinning({
        userId,
        fileId,
        selected_columns: selectedColumns,
        method: selectedMethod,
        n_bins: typeof nBins === "number" ? nBins : parseInt(String(nBins), 10) || 5,
        min_freq: minFreq,
        target_column: targetColumn || undefined,
        similarity_threshold: similarityThreshold,
        custom_mapping: selectedMethod === "custom" ? customMapping : undefined,
      });

      toast.success("Success", {
        description: `Categorical binning applied successfully using ${methods.find((m) => m.value === selectedMethod)?.label}.`,
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
              className="flex items-start gap-2.5 cursor-pointer hover:bg-accent/50 px-3 py-2 rounded-md transition-colors"
              title={method.description}
            >
              <input
                type="radio"
                name="binning-method"
                value={method.value}
                checked={selectedMethod === method.value}
                onChange={() => setSelectedMethod(method.value)}
                className="h-4 w-4 accent-primary cursor-pointer mt-0.5"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-muted-foreground">{method.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Number of Categories to Keep (not used for similarity-based or custom) */}
      {selectedMethod !== "similarity" && selectedMethod !== "custom" && (
        <div className="space-y-2">
          <Label htmlFor="n-bins" className="text-sm font-medium">
            Number of Categories
          </Label>
          <Input
            id="n-bins"
            type="number"
            min={1}
            max={50}
            value={nBins}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty string for backspacing
              if (value === "") {
                setNBins("" as any);
              } else {
                const parsed = parseInt(value, 10);
                if (!isNaN(parsed)) {
                  setNBins(parsed);
                }
              }
            }}
            onBlur={(e) => {
              // Set to default if empty on blur
              if (e.target.value === "") {
                setNBins(5);
              }
            }}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Maximum number of categories/bins to create (1-50)
          </p>
        </div>
      )}

      {/* Frequency Threshold (for frequency method) */}
      {selectedMethod === "frequency" && (
        <div className="space-y-2">
          <Label htmlFor="min-freq" className="text-sm font-medium">
            Minimum Frequency
          </Label>
          <Input
            id="min-freq"
            type="number"
            min={1}
            value={minFreq}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!isNaN(value)) {
                setMinFreq(value);
              }
            }}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Minimum occurrences to keep category separate
          </p>
        </div>
      )}

      {/* Target Column Selection (for target-based method) */}
      {selectedMethod === "target-based" && (
        <div className="space-y-2">
          <Label htmlFor="target-column" className="text-sm font-medium">
            Target Column
          </Label>
          <Select value={targetColumn} onValueChange={setTargetColumn}>
            <SelectTrigger>
              <SelectValue placeholder="Select target column..." />
            </SelectTrigger>
            <SelectContent>
              {selectableColumns
                .filter((col) => !selectedColumns.includes(col))
                .map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Column to use for grouping categories by target relationship
          </p>
        </div>
      )}

      {/* Similarity Threshold (for similarity method) */}
      {selectedMethod === "similarity" && (
        <div className="space-y-2">
          <Label htmlFor="similarity-threshold" className="text-sm font-medium">
            Similarity Threshold
          </Label>
          <Input
            id="similarity-threshold"
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={similarityThreshold}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value)) {
                setSimilarityThreshold(value);
              }
            }}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Threshold for grouping similar text (0-1, higher = more similar required)
          </p>
        </div>
      )}

      {/* Custom Mapping (for custom method) */}
      {selectedMethod === "custom" && selectedColumns.length === 1 && (
        <CustomMappingBuilder
          userId={userId}
          fileId={fileId}
          selectedColumn={selectedColumns[0]}
          onMappingChange={setCustomMapping}
        />
      )}

      {selectedMethod === "custom" && selectedColumns.length !== 1 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            ⚠️ Custom mapping works with one column at a time. Please select exactly one column.
          </p>
        </div>
      )}

      {/* Column Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Select Categorical Columns</Label>
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
        <p className="text-xs text-amber-600">
          ⚠️ Only select text/categorical columns. Numeric columns will be rejected.
        </p>
      </div>

      {/* Apply Button */}
      <Button
        onClick={handleApply}
        disabled={selectedColumns.length === 0 || isLoading}
        className="w-full"
        size="sm"
      >
        {isLoading ? "Applying..." : "Apply Categorical Binning"}
      </Button>
    </div>
  );
}
