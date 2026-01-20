/**
 * MultiColumnSelector Component
 * Allows users to select multiple columns for correlation matrix analysis
 */
import React from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import { Label } from "@/components/ui/label";

interface MultiColumnSelectorProps {
  availableColumns: string[];
  selectedColumns: string[];
  onAddColumn: (column: string) => void;
  onRemoveColumn: (column: string) => void;
  minColumns?: number;
}

export const MultiColumnSelector: React.FC<MultiColumnSelectorProps> = ({
  availableColumns,
  selectedColumns,
  onAddColumn,
  onRemoveColumn,
  minColumns = 3,
}) => {
  const handleChange = (newSelectedColumns: string[]) => {
    // Check if a column was added or removed
    if (newSelectedColumns.length > selectedColumns.length) {
      // Column was added
      const addedColumn = newSelectedColumns.find(
        (col) => !selectedColumns.includes(col),
      );
      if (addedColumn) {
        onAddColumn(addedColumn);
      }
    } else {
      // Column was removed
      const removedColumn = selectedColumns.find(
        (col) => !newSelectedColumns.includes(col),
      );
      if (removedColumn) {
        onRemoveColumn(removedColumn);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block text-sm font-medium">
          Select Columns (minimum {minColumns})
        </Label>

        <MultiSelect
          options={availableColumns}
          value={selectedColumns}
          onChange={handleChange}
          placeholder="Select multiple columns..."
          className="w-full"
        />

        {selectedColumns.length > 0 && selectedColumns.length < minColumns && (
          <p className="text-sm text-muted-foreground mt-2">
            Please select at least {minColumns - selectedColumns.length} more
            column(s)
          </p>
        )}
      </div>
    </div>
  );
};
