/**
 * CorrelationDetailModal Component
 * Display detailed correlation statistics in a modal
 */
import React from "react";
import type { CorrelationResult } from "../api/correlation";
import { X } from "lucide-react";

interface CorrelationDetailModalProps {
  result: CorrelationResult;
  onClose: () => void;
}

export const CorrelationDetailModal: React.FC<CorrelationDetailModalProps> = ({
  result,
  onClose,
}) => {
  const getInterpretation = (
    effectSize: number | undefined,
    pValue: number,
  ): string => {
    if (pValue >= 0.05) return "Not statistically significant";
    if (!effectSize) return "Statistically significant";

    const abs = Math.abs(effectSize);
    if (abs >= 0.7) return "Strong correlation";
    if (abs >= 0.5) return "Moderate correlation";
    if (abs >= 0.3) return "Weak correlation";
    return "Very weak correlation";
  };

  const getSignificanceLevel = (pValue: number): string => {
    if (pValue < 0.001) return "p < 0.001 (highly significant)";
    if (pValue < 0.01) return "p < 0.01 (very significant)";
    if (pValue < 0.05) return "p < 0.05 (significant)";
    return `p = ${pValue.toFixed(4)} (not significant)`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Correlation Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Variables */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Variables
            </h3>
            <p className="text-lg">
              <strong>{result.variable1_name}</strong> ×{" "}
              <strong>{result.variable2_name}</strong>
            </p>
          </div>

          {/* Method */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Statistical Method
            </h3>
            <p className="text-lg font-medium">{result.method_name}</p>
          </div>

          {/* Results */}
          <div className="grid grid-cols-2 gap-4">
            {result.result.effect_size !== undefined && (
              <div className="bg-blue-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-gray-700 mb-1">
                  Effect Size
                </h3>
                <p className="text-2xl font-bold text-blue-900">
                  {result.result.effect_size.toFixed(4)}
                </p>
              </div>
            )}

            <div className="bg-purple-50 p-4 rounded-md">
              <h3 className="text-sm font-medium text-gray-700 mb-1">
                P-Value
              </h3>
              <p className="text-2xl font-bold text-purple-900">
                {result.result.p_value < 0.001
                  ? "<0.001"
                  : result.result.p_value.toFixed(4)}
              </p>
            </div>

            {result.result.statistic !== undefined && (
              <div className="bg-green-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-gray-700 mb-1">
                  Test Statistic
                </h3>
                <p className="text-2xl font-bold text-green-900">
                  {result.result.statistic.toFixed(4)}
                </p>
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="text-sm font-medium text-gray-700 mb-1">
                Sample Size
              </h3>
              <p className="text-2xl font-bold text-gray-900">
                {result.sample_size}
              </p>
            </div>
          </div>

          {/* Confidence Interval */}
          {result.result.confidence_interval && (
            <div className="bg-indigo-50 p-4 rounded-md">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                95% Confidence Interval
              </h3>
              <p className="text-lg font-medium text-indigo-900">
                [{result.result.confidence_interval[0].toFixed(4)},{" "}
                {result.result.confidence_interval[1].toFixed(4)}]
              </p>
            </div>
          )}

          {/* Interpretation */}
          <div className="bg-amber-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Interpretation
            </h3>
            <p className="text-lg font-medium text-amber-900">
              {getInterpretation(
                result.result.effect_size,
                result.result.p_value,
              )}
            </p>
            <p className="text-sm text-amber-700 mt-1">
              {getSignificanceLevel(result.result.p_value)}
            </p>
          </div>

          {/* Data quality */}
          {result.removed_rows > 0 && (
            <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">
                Data Quality Note
              </h3>
              <p className="text-sm text-yellow-700">
                {result.removed_rows} row(s) removed due to missing values
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
