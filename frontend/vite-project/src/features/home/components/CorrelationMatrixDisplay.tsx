/**
 * CorrelationMatrixDisplay Component
 * Display correlation matrix as an interactive heatmap
 */
import React from "react";
import type { MatrixAnalysisResult, MatrixCell } from "../api/correlation";

interface CorrelationMatrixDisplayProps {
  result: MatrixAnalysisResult;
  onCellClick?: (cell: MatrixCell) => void;
}

export const CorrelationMatrixDisplay: React.FC<
  CorrelationMatrixDisplayProps
> = ({ result, onCellClick }) => {
  const getColorForValue = (value: number, isDiagonal: boolean): string => {
    if (isDiagonal) return "bg-gray-200";

    const absValue = Math.abs(value);
    if (absValue >= 0.7) return "bg-red-500 text-white";
    if (absValue >= 0.5) return "bg-orange-400 text-white";
    if (absValue >= 0.3) return "bg-yellow-300";
    if (absValue >= 0.1) return "bg-green-200";
    return "bg-blue-100";
  };

  const getSignificanceMarker = (pValue: number): string => {
    if (pValue < 0.001) return "***";
    if (pValue < 0.01) return "**";
    if (pValue < 0.05) return "*";
    return "";
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Correlation Matrix</h3>
        <p className="text-sm text-gray-600 mb-4">
          Click on any cell to view detailed statistics. Significance: *
          p&lt;0.05, ** p&lt;0.01, *** p&lt;0.001
        </p>
      </div>

      {/* Matrix heatmap */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-gray-100 p-2"></th>
              {result.columns.map((col) => (
                <th
                  key={col}
                  className="border border-gray-300 bg-gray-100 p-2 text-xs font-medium text-center"
                  style={{ minWidth: "80px" }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.matrix.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td className="border border-gray-300 bg-gray-100 p-2 font-medium text-xs">
                  {result.columns[rowIdx]}
                </td>
                {row.map((cell, colIdx) => {
                  const colorClass = getColorForValue(
                    cell.correlation,
                    cell.is_diagonal,
                  );
                  const significance = getSignificanceMarker(cell.p_value);

                  return (
                    <td
                      key={colIdx}
                      className={`border border-gray-300 p-2 text-center transition-opacity ${colorClass} ${
                        cell.is_diagonal
                          ? ""
                          : "cursor-pointer hover:opacity-75"
                      }`}
                      onClick={() => !cell.is_diagonal && onCellClick?.(cell)}
                      title={
                        cell.is_diagonal
                          ? "Self-correlation"
                          : `Click for details\n${cell.row_name} × ${cell.col_name}`
                      }
                    >
                      <div className="text-sm font-semibold">
                        {cell.correlation.toFixed(3)}
                      </div>
                      {!cell.is_diagonal && significance && (
                        <div className="text-xs font-bold">{significance}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-red-500 border border-gray-300"></div>
          <span>Strong (≥0.7)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-400 border border-gray-300"></div>
          <span>Moderate (0.5-0.7)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-yellow-300 border border-gray-300"></div>
          <span>Weak (0.3-0.5)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-green-200 border border-gray-300"></div>
          <span>Very Weak (0.1-0.3)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-100 border border-gray-300"></div>
          <span>Negligible (&lt;0.1)</span>
        </div>
      </div>
    </div>
  );
};
