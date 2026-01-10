import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { getFileData } from "../../home/api/uploads";

interface DataReductionPanelProps {
  columns: string[];
  userId: string;
  fileId: string;
  onSuccess?: () => void;
}

type ReductionMethod = "auto" | "mca" | "famd";

interface ReductionSummary {
  method: string;
  components: number;
  inputColumns: number;
  outputColumns: number;
  originalColumns?: number | null;
  drColumns?: number | null;
  varianceExplained?: number[] | null;
  totalVariance?: number | null;
}

export function DataReductionPanel({
  columns,
  userId,
  fileId,
  onSuccess,
}: DataReductionPanelProps) {
  const [selectedMethod, setSelectedMethod] = useState<ReductionMethod>("auto");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [nComponents, setNComponents] = useState<number>(8);
  const [rareThreshold, setRareThreshold] = useState<number>(5);
  const [maxCardinality, setMaxCardinality] = useState<number>(200);
  const [sampleSize, setSampleSize] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<ReductionSummary | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);

  const { data: fileData } = useQuery({
    queryKey: ["fileData", userId, fileId],
    queryFn: () => getFileData({ userId, fileId }),
    enabled: Boolean(userId && fileId),
  });

  const numericColumns = useMemo(() => {
    if (!fileData) return [];

    return fileData.columns.filter((col) => {
      if (col === "id") return false;
      const values = fileData.rows
        .map((row) => row[col])
        .filter((v) => v !== null && v !== undefined && String(v).trim() !== "");

      if (values.length === 0) return false;

      const numericCount = values.filter((v) => {
        const strVal = String(v).replace(/,/g, "");
        const num = parseFloat(strVal);
        return !isNaN(num) && isFinite(num);
      }).length;

      return numericCount / values.length >= 0.8;
    });
  }, [fileData]);

  const selectableColumns = (columns || []).filter((col) => col !== "id");

  const getErrorHint = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes("missing values")) {
      return "Tip: Run Handle Missing Values first (median for numeric, mode or missing-category for categorical).";
    }
    if (lower.includes("no usable columns")) {
      return "Tip: Reduce high-cardinality protection or choose different columns.";
    }
    if (lower.includes("mca only supports")) {
      return "Tip: Remove numeric columns or switch to Auto/FAMD.";
    }
    if (lower.includes("numeric-only")) {
      return "Tip: Select categorical columns or use a numeric-only workflow.";
    }
    if (lower.includes("factominer")) {
      return "Tip: Install the R package FactoMineR and restart the backend.";
    }
    return null;
  };

  const handleApply = async () => {
    if (selectedColumns.length === 0) {
      toast.error("No columns selected", {
        description:
          "Please select at least one column to apply data reduction.",
      });
      return;
    }

    if (nComponents < 2 || nComponents > 100) {
      toast.error("Invalid number of components", {
        description: "Components must be between 2 and 100.",
      });
      return;
    }

    const selectedNumeric = selectedColumns.filter((col) =>
      numericColumns.includes(col),
    );
    const hasNumeric = selectedNumeric.length > 0;
    const allNumeric = selectedNumeric.length === selectedColumns.length;

    if (allNumeric) {
      toast.error("Numeric-only data detected", {
        description:
          "Data Reduction is designed for qualitative data. Please select categorical columns or handle numeric-only data separately.",
      });
      return;
    }

    if (selectedMethod === "mca" && hasNumeric) {
      toast.error("MCA requires categorical data", {
        description:
          "MCA only works with categorical columns. Switch to Auto/FAMD or remove numeric columns.",
      });
      return;
    }

    setIsLoading(true);
    setErrorHint(null);
    setSummary(null);

    try {
      const { handleDataReduction } = await import("../../home/api/uploads");

      const result = await handleDataReduction({
        userId,
        fileId,
        selected_columns: selectedColumns,
        method: selectedMethod,
        n_components: nComponents,
        rare_threshold: rareThreshold,
        max_cardinality: maxCardinality,
        sample_size: sampleSize > 0 ? sampleSize : undefined,
      });

      if (result.summary) {
        setSummary(result.summary);
      }

      toast.success("Success", {
        description: "Data reduction applied successfully.",
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error("Failed to apply data reduction", {
        description: errorMessage,
      });
      setErrorHint(getErrorHint(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Applies to the current dataset (selected.csv). This will append numeric components to your existing columns.
      </p>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Method</Label>
        <div className="space-y-0.5">
          {[
            { value: "auto", label: "Auto (recommended)" },
            { value: "mca", label: "MCA (categorical only)" },
            { value: "famd", label: "FAMD (mixed data)" },
          ].map((method) => (
            <label
              key={method.value}
              className="flex items-center gap-2.5 cursor-pointer hover:bg-accent/50 px-3 py-1.5 rounded-md transition-colors"
            >
              <input
                type="radio"
                name="data-reduction-method"
                value={method.value}
                checked={selectedMethod === method.value}
                onChange={() =>
                  setSelectedMethod(method.value as ReductionMethod)
                }
                className="h-4 w-4 accent-primary cursor-pointer"
              />
              <span className="text-sm">{method.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="n-components" className="text-sm font-medium">
          Number of Components (k)
        </Label>
        <Input
          id="n-components"
          type="number"
          min={2}
          max={100}
          value={nComponents}
          onChange={(e) => {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value)) {
              setNComponents(value);
            }
          }}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Reduce to a smaller numeric feature set for ML/correlation.
        </p>
      </div>

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

        {selectableColumns.length === 0 ? (
          <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md">
            No columns available for reduction.
          </div>
        ) : (
          <MultiSelect
            options={selectableColumns}
            value={selectedColumns}
            onChange={setSelectedColumns}
            placeholder="Search columns..."
          />
        )}

        {selectedColumns.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedColumns.length} column
            {selectedColumns.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between"
        onClick={() => setShowAdvanced((prev) => !prev)}
      >
        Advanced options
        <span className="text-xs text-muted-foreground">
          {showAdvanced ? "Hide" : "Show"}
        </span>
      </Button>

      {showAdvanced && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-2">
            <Label htmlFor="rare-threshold" className="text-sm font-medium">
              Rare Category Threshold
            </Label>
            <Input
              id="rare-threshold"
              type="number"
              min={1}
              value={rareThreshold}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value)) {
                  setRareThreshold(value);
                }
              }}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Group categories with fewer than this count into "Other".
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-cardinality" className="text-sm font-medium">
              High-Cardinality Protection
            </Label>
            <Input
              id="max-cardinality"
              type="number"
              min={5}
              value={maxCardinality}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value)) {
                  setMaxCardinality(value);
                }
              }}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Skip columns with more unique values than this limit.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sample-size" className="text-sm font-medium">
              Preview Sampling (rows)
            </Label>
            <Input
              id="sample-size"
              type="number"
              min={0}
              value={sampleSize}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value)) {
                  setSampleSize(value);
                }
              }}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Optional: use a subset for faster preview (0 = full data).
            </p>
          </div>
        </div>
      )}

      {summary && (
        <div className="rounded-md border p-3 text-xs text-muted-foreground">
          <p>
            Method: <span className="text-foreground">{summary.method}</span>
          </p>
          <p>
            Components: {" "}
            <span className="text-foreground">{summary.components}</span>
          </p>
          <p>
            Selected columns: {" "}
            <span className="text-foreground">{summary.inputColumns}</span>
          </p>
          <p>
            Original columns: {" "}
            <span className="text-foreground">
              {summary.originalColumns ?? "-"}
            </span>
          </p>
          <p>
            DR columns: {" "}
            <span className="text-foreground">
              {summary.drColumns ?? summary.components}
            </span>
          </p>
          <p>
            Total columns: {" "}
            <span className="text-foreground">{summary.outputColumns}</span>
          </p>
          {summary.totalVariance !== null && summary.totalVariance !== undefined && (
            <p>
              Total variance explained: {" "}
              <span className="text-foreground">
                {summary.totalVariance}%
              </span>
            </p>
          )}
          {summary.varianceExplained && summary.varianceExplained.length > 0 && (
            <p>
              Per-component variance: {" "}
              <span className="text-foreground">
                {summary.varianceExplained.slice(0, 6).join(", ")}%
              </span>
            </p>
          )}
        </div>
      )}

      {errorHint && (
        <div className="text-xs text-amber-600">
          {errorHint}
        </div>
      )}

      <Button
        onClick={handleApply}
        disabled={
          selectableColumns.length === 0 ||
          selectedColumns.length === 0 ||
          isLoading
        }
        className="w-full"
        size="sm"
      >
        {isLoading ? "Applying..." : "Run Data Reduction"}
      </Button>
    </div>
  );
}






