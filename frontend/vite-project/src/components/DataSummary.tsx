import { useMemo, useRef } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ArrowUpDown } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { isDateTimeColumn } from "../lib/columnFilters";

interface DataSummaryProps {
  columns: string[];
  rows: Array<Record<string, string>>;
}

export function DataSummary({ columns, rows }: DataSummaryProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const columnStats = useMemo(() => {
    return columns.map((column) => {
      const values = rows.map((row) => row[column]);
      const nonEmptyValues = values.filter((v) => v !== null && v !== undefined && v.trim() !== "");
      const uniqueValues = new Set(nonEmptyValues);
      const missingCount = values.length - nonEmptyValues.length;
      const missingPercentage = values.length > 0 ? (missingCount / values.length) * 100 : 0;

      // Calculate column width based on content
      const headerLength = column.length;
      const maxContentLength = Math.max(
        ...values.slice(0, 50).map((v) => (v || "").length),
        0
      );
      const maxLength = Math.max(headerLength, maxContentLength);
      const columnWidth = Math.min(Math.max(maxLength * 8, 100), 300);

      // Determine type
      let type = "Other";
      if (nonEmptyValues.length === 0) {
        type = "Other";
      } else {
        // Check if it's a date/time column using shared utility
        if (isDateTimeColumn(column, rows)) {
          type = "Date/Time";
        } else {
          // Check if numeric first (≥80% numeric values)
          const numericCount = nonEmptyValues.filter((v) => {
            try {
              const cleaned = v.replace(/,/g, "").trim();
              return !isNaN(parseFloat(cleaned)) && /^[-+]?\d*\.?\d+([eE][-+]?\d+)?$/.test(cleaned);
            } catch {
              return false;
            }
          }).length;

          const isNumeric = numericCount / nonEmptyValues.length >= 0.8;

          if (isNumeric) {
            type = "Numeric";
          } else {
            // Check if text (average length > 25 chars)
            const avgLength = nonEmptyValues.reduce((sum, v) => sum + v.length, 0) / nonEmptyValues.length;
            
            if (avgLength > 25) {
              type = "Text";
            } else {
              // Check unique ratio to determine if categorical or other
              const uniqueRatio = uniqueValues.size / nonEmptyValues.length;
              
              // Categorical: limited set of values (unique ratio < 0.5)
              // This means the column has repeated values, which is typical of categories
              if (uniqueRatio < 0.5) {
                type = "Categorical";
              } else {
                // High unique ratio (>= 0.5) suggests it's not categorical
                // These could be IDs, codes, or other unique identifiers
                type = "Other";
              }
            }
          }
        }
      }

      return {
        column,
        type,
        uniqueCount: uniqueValues.size,
        missingCount,
        missingPercentage: missingPercentage.toFixed(2),
        columnWidth,
      };
    });
  }, [columns, rows]);

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "Numeric":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "Categorical":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "Text":
        return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200";
      case "Date/Time":
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  // Define column headers and cells
  const headers = [
    <Button
      key="column"
      variant="ghost"
      className="h-7 px-2 lg:px-3 w-full justify-start text-xs"
    >
      <span className="truncate flex-1 text-left">Column</span>
      <span className="flex-shrink-0 ml-1">
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </Button>,
    <Button
      key="type"
      variant="ghost"
      className="h-7 px-2 lg:px-3 w-full justify-start text-xs"
    >
      <span className="truncate flex-1 text-left">Type</span>
      <span className="flex-shrink-0 ml-1">
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </Button>,
    <Button
      key="missing"
      variant="ghost"
      className="h-7 px-2 lg:px-3 w-full justify-start text-xs"
    >
      <span className="truncate flex-1 text-left">Missing</span>
      <span className="flex-shrink-0 ml-1">
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </Button>,
    <Button
      key="missingpct"
      variant="ghost"
      className="h-7 px-2 lg:px-3 w-full justify-start text-xs"
    >
      <span className="truncate flex-1 text-left">Missing %</span>
      <span className="flex-shrink-0 ml-1">
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </Button>,
    <Button
      key="unique"
      variant="ghost"
      className="h-7 px-2 lg:px-3 w-full justify-start text-xs"
    >
      <span className="truncate flex-1 text-left">Unique Values</span>
      <span className="flex-shrink-0 ml-1">
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </Button>
  ];

  const columnDefs = [
    {
      size: () => {
        const maxLength = Math.max(
          ...columnStats.map(s => s.column.length),
          6
        );
        return Math.min(Math.max(maxLength * 9 + 40, 120), 400);
      },
      cell: (stat: any) => (
        <div className="w-full h-full flex items-center px-2" title={stat.column}>
          <span className="w-full text-xs overflow-visible whitespace-nowrap">{stat.column}</span>
        </div>
      )
    },
    {
      size: 120,
      cell: (stat: any) => (
        <div className="w-full h-full flex items-center px-2">
          <Badge variant="outline" className={`${getTypeBadgeColor(stat.type)} text-xs`}>
            {stat.type}
          </Badge>
        </div>
      )
    },
    {
      size: 100,
      cell: (stat: any) => (
        <div className="w-full h-full flex items-center justify-end px-2">
          <span className="text-xs">{stat.missingCount.toLocaleString()}</span>
        </div>
      )
    },
    {
      size: 110,
      cell: (stat: any) => (
        <div className="w-full h-full flex items-center justify-end px-2">
          <span
            className={`text-xs ${
              parseFloat(stat.missingPercentage) > 10
                ? "text-red-600 dark:text-red-400 font-semibold"
                : "text-green-600 dark:text-green-400"
            }`}
          >
            {stat.missingPercentage}%
          </span>
        </div>
      )
    },
    {
      size: 160,
      cell: (stat: any) => (
        <div className="w-full h-full flex items-center justify-end px-2">
          <span className="text-xs">{stat.uniqueCount.toLocaleString()}</span>
        </div>
      )
    }
  ];

  // Row virtualizer
  const rowVirtualizer = useVirtualizer({
    count: columnStats.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  // Column virtualizer
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columnDefs.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: (index) => {
      const def = columnDefs[index];
      if (typeof def.size === 'function') {
        return def.size();
      }
      return def?.size || 100;
    },
    overscan: 3,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  const totalRowSize = rowVirtualizer.getTotalSize();
  const totalColumnSize = columnVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalRowSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0;
  const paddingLeft =
    virtualColumns.length > 0 ? virtualColumns[0]?.start || 0 : 0;
  const paddingRight =
    virtualColumns.length > 0
      ? totalColumnSize - (virtualColumns[virtualColumns.length - 1]?.end || 0)
      : 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div ref={tableContainerRef} className="flex-1 overflow-auto">
        {/* Table container with fixed total size */}
        <div
          style={{
            height: `${totalRowSize + 50}px`,
            width: `${totalColumnSize}px`,
            minWidth: '100%'
          }}
        >
          {/* Sticky header */}
          <div
            className="sticky top-0 bg-background z-2 border-b"
            style={{ display: "flex" }}
          >
            {paddingLeft > 0 && <div style={{ width: `${paddingLeft}px` }} />}
            {virtualColumns.map((virtualColumn) => {
              const header = headers[virtualColumn.index];
              return (
                <div
                  key={virtualColumn.key}
                  className="text-left align-middle border-r overflow-hidden"
                  style={{
                    width: `${virtualColumn.size}px`,
                  }}
                >
                  {header}
                </div>
              );
            })}
            {paddingRight > 0 && <div style={{ width: `${paddingRight}px` }} />}
          </div>

          {/* Virtual rows */}
          <div>
            {paddingTop > 0 && <div style={{ height: `${paddingTop}px` }} />}
            {virtualRows.map((virtualRow) => {
              const stat = columnStats[virtualRow.index];
              if (!stat) return null;

              return (
                <div
                  key={virtualRow.key}
                  className="border-b transition-colors hover:bg-muted/50"
                  style={{
                    display: "flex",
                    height: `${virtualRow.size}px`,
                  }}
                >
                  {paddingLeft > 0 && (
                    <div style={{ width: `${paddingLeft}px` }} />
                  )}
                  {virtualColumns.map((virtualColumn) => {
                    const columnDef = columnDefs[virtualColumn.index];
                    return (
                      <div
                        key={virtualColumn.key}
                        className="align-middle flex items-center border-r overflow-hidden"
                        style={{
                          width: `${virtualColumn.size}px`,
                        }}
                      >
                        {columnDef && columnDef.cell(stat)}
                      </div>
                    );
                  })}
                  {paddingRight > 0 && (
                    <div style={{ width: `${paddingRight}px` }} />
                  )}
                </div>
              );
            })}
            {paddingBottom > 0 && (
              <div style={{ height: `${paddingBottom}px` }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
