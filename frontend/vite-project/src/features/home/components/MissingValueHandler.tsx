/**
 * MissingValueHandler Component
 * Display missing value information and allow user to select handling strategy
 */
import React from "react";
import type { ColumnInfo, MissingValueMethod } from "../api/correlation";
import { AlertCircle } from "lucide-react";

interface MissingValueHandlerProps {
  missingValueInfo: ColumnInfo[];
  hasMissing: boolean;
  selectedMethod: MissingValueMethod;
  onMethodChange: (method: MissingValueMethod) => void;
}

export const MissingValueHandler: React.FC<MissingValueHandlerProps> = ({
  missingValueInfo,
  hasMissing,
  selectedMethod,
  onMethodChange,
}) => {
  const methods: {
    value: MissingValueMethod;
    label: string;
    description: string;
  }[] = [
    {
      value: "remove",
      label: "Pairwise Deletion",
      description:
        "Remove rows with missing values for each pair independently (recommended)",
    },
    {
      value: "mode",
      label: "Mode Imputation",
      description: "Replace missing values with the most frequent category",
    },
    {
      value: "median",
      label: "Median Imputation",
      description: "Replace with median category (ordinal) or mode (nominal)",
    },
    {
      value: "missing_category",
      label: "Missing Category",
      description: "Treat missing values as a separate category",
    },
  ];

  if (!hasMissing) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-md">
        <p className="text-green-800 text-sm">
          ✓ No missing values detected in selected columns
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Missing value summary */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
        <div className="flex items-start gap-2">
          <AlertCircle className="text-amber-600 mt-0.5" size={20} />
          <div className="flex-1">
            <h4 className="font-medium text-amber-900 mb-2">
              Missing Values Detected
            </h4>
            <div className="space-y-1">
              {missingValueInfo.map(
                (info) =>
                  info.missingCount > 0 && (
                    <div
                      key={info.columnName}
                      className="text-sm text-amber-800"
                    >
                      <strong>{info.columnName}:</strong> {info.missingCount}{" "}
                      missing ({info.missingPercentage.toFixed(1)}%)
                    </div>
                  ),
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Strategy selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Missing Value Handling Strategy
        </label>
        <div className="space-y-2">
          {methods.map((method) => (
            <label
              key={method.value}
              className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                selectedMethod === method.value
                  ? "bg-blue-50 border-blue-500"
                  : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="missing-value-method"
                value={method.value}
                checked={selectedMethod === method.value}
                onChange={() => onMethodChange(method.value)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{method.label}</div>
                <div className="text-sm text-gray-600">
                  {method.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
