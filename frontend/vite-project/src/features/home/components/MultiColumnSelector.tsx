/**
 * MultiColumnSelector Component
 * Allows users to select multiple columns for correlation matrix analysis
 */
import React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  maxColumns = 10,
}) => {
  const unselectedColumns = availableColumns.filter(
    (col) => !selectedColumns.includes(col),
  );

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block text-sm font-medium">
          Select Columns (minimum {minColumns}, maximum {maxColumns})
        </Label>

        {/* Selected columns */}
        <div className="flex flex-wrap gap-2 mb-3 min-h-[40px] p-2 border border-border rounded-md bg-muted/50">
          {selectedColumns.length === 0 ? (
            <span className="text-muted-foreground text-sm">
              No columns selected
            </span>
          ) : (
            selectedColumns.map((col) => (
              <Badge
                key={col}
                variant="secondary"
                className="inline-flex items-center gap-2 px-3 py-1 text-sm"
              >
                {col}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onRemoveColumn(col)}
                  className="h-6 w-6"
                  title="Remove column"
                >
                  <X size={14} />
                </Button>
              </Badge>
            ))
          )}
        </div>

        {/* Available columns dropdown */}
        {unselectedColumns.length > 0 &&
          selectedColumns.length < maxColumns && (
            <Select
              onValueChange={(value) => {
                onAddColumn(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Add a column..." />
              </SelectTrigger>
              <SelectContent>
                {unselectedColumns.map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

        {selectedColumns.length >= maxColumns && (
          <p className="text-sm text-amber-600 mt-2">
            Maximum of {maxColumns} columns reached
          </p>
        )}
      </div>

      {selectedColumns.length > 0 && selectedColumns.length < minColumns && (
        <p className="text-sm text-amber-600">
          Please select at least {minColumns - selectedColumns.length} more
          column(s)
        </p>
      )}
    </div>
  );
};
