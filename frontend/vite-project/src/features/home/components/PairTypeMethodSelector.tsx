/**
 * PairTypeMethodSelector Component
 * Select correlation methods for each pair type in matrix analysis
 */
import React, { useEffect, useState } from "react";
import { getMethods } from "../api/correlation";
import type { CorrelationMethod } from "../api/correlation";

interface PairTypeMethodSelectorProps {
  methodsByPairType: Record<string, string>;
  onMethodChange: (pairType: string, method: string) => void;
}

export const PairTypeMethodSelector: React.FC<PairTypeMethodSelectorProps> = ({
  methodsByPairType,
  onMethodChange,
}) => {
  const [availableMethods, setAvailableMethods] = useState<{
    [key: string]: CorrelationMethod[];
  }>({});
  const [loading, setLoading] = useState(true);

  const pairTypes = [
    {
      key: "nominal-nominal",
      label: "Nominal ↔ Nominal",
      type1: "nominal",
      type2: "nominal",
    },
    {
      key: "ordinal-ordinal",
      label: "Ordinal ↔ Ordinal",
      type1: "ordinal",
      type2: "ordinal",
    },
    {
      key: "nominal-ordinal",
      label: "Nominal ↔ Ordinal",
      type1: "nominal",
      type2: "ordinal",
    },
  ] as const;

  useEffect(() => {
    const fetchMethods = async () => {
      setLoading(true);
      try {
        const methods: { [key: string]: CorrelationMethod[] } = {};

        for (const pairType of pairTypes) {
          const result = await getMethods(pairType.type1, pairType.type2);
          methods[pairType.key] = result;
        }

        setAvailableMethods(methods);
      } catch (error) {
        console.error("Failed to fetch methods:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMethods();
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-gray-600">Loading available methods...</div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-700">
        Select Correlation Methods by Pair Type
      </h3>

      {pairTypes.map((pairType) => {
        const methods = availableMethods[pairType.key] || [];
        const selectedMethod = methodsByPairType[pairType.key];

        return (
          <div
            key={pairType.key}
            className="border border-gray-300 rounded-md p-4 bg-white"
          >
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {pairType.label}
            </label>

            <select
              value={selectedMethod || ""}
              onChange={(e) => onMethodChange(pairType.key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              {methods.length === 0 ? (
                <option value="">No methods available</option>
              ) : (
                methods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))
              )}
            </select>

            {selectedMethod &&
              methods.find((m) => m.value === selectedMethod) && (
                <p className="text-xs text-gray-600 mt-2">
                  {methods.find((m) => m.value === selectedMethod)?.description}
                </p>
              )}
          </div>
        );
      })}
    </div>
  );
};
