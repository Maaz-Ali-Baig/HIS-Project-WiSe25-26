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
  maxColumns?: number;
}

export const MultiColumnSelector: React.FC<MultiColumnSelectorProps> = ({
  availableColumns,
  selectedColumns,
  onAddColumn,
  onRemoveColumn,
  minColumns = 3,
  maxColumns,
}) => {
  const handleChange = (newSelectedColumns: string[]) => {
    // Check if columns were added or removed
    if (newSelectedColumns.length > selectedColumns.length) {
      // Column(s) were added - handle bulk additions (like Select All)
      const addedColumns = newSelectedColumns.filter(
        (col) => !selectedColumns.includes(col)
      );
      
      // Check max limit before adding
      if (!maxColumns || newSelectedColumns.length <= maxColumns) {
        // Add all columns at once by calling onAddColumn for each
        addedColumns.forEach((col) => onAddColumn(col));
      }
    } else if (newSelectedColumns.length < selectedColumns.length) {
      // Column(s) were removed - handle bulk removals (like Deselect All)
      const removedColumns = selectedColumns.filter(
        (col) => !newSelectedColumns.includes(col)
      );
      
      // Remove all columns by calling onRemoveColumn for each
      removedColumns.forEach((col) => onRemoveColumn(col));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block text-sm font-medium">
          Select Columns (minimum {minColumns}{maxColumns ? `, maximum ${maxColumns}` : ""})
        </Label>

        <MultiSelect
          options={availableColumns}
          value={selectedColumns}
          onChange={handleChange}
          placeholder="Select multiple columns..."
          className="w-full"
        />

        {maxColumns && selectedColumns.length >= maxColumns && (
          <p className="text-sm text-amber-600 mt-2">
            Maximum of {maxColumns} columns reached
          </p>
        )}

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
