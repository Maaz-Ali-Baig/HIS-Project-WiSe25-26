/**
 * Multi-Correlation Store (Matrix Analysis)
 * Manages state for multi-column correlation matrix analysis
 */
import { create } from "zustand";
import type {
  VariableConfig,
  MatrixAnalysisResult,
  MissingValueMethod,
  ColumnInfo,
} from "../features/home/api/correlation";

interface MultiCorrelationState {
  // Data source
  userId: string | null;
  fileId: string | null;

  // Available data
  availableColumns: string[];
  columnCategories: Record<string, string[]>;

  // Column selection
  selectedColumns: string[];

  // Variable configurations for all selected columns
  variableConfigs: Record<string, VariableConfig>;

  // Missing value handling
  missingValueInfo: ColumnInfo[];
  hasMissingValues: boolean;
  selectedMissingValueMethod: MissingValueMethod;

  // Method selection by pair type
  methodsByPairType: Record<string, string>;

  // Results
  matrixResult: MatrixAnalysisResult | null;

  // UI state
  isLoading: boolean;
  error: string | null;
  currentStep: "select" | "configure" | "missing" | "methods" | "results";

  // Actions
  setDataSource: (userId: string, fileId: string) => void;
  setAvailableColumns: (
    columns: string[],
    categories: Record<string, string[]>,
  ) => void;
  setSelectedColumns: (columns: string[]) => void;
  addColumn: (column: string) => void;
  removeColumn: (column: string) => void;
  setVariableConfig: (columnName: string, config: VariableConfig) => void;
  setMissingValueInfo: (info: ColumnInfo[], hasMissing: boolean) => void;
  setMissingValueMethod: (method: MissingValueMethod) => void;
  setMethodForPairType: (pairType: string, method: string) => void;
  setMatrixResult: (result: MatrixAnalysisResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentStep: (
    step: "select" | "configure" | "missing" | "methods" | "results",
  ) => void;
  reset: () => void;
}

const initialState = {
  userId: null,
  fileId: null,
  availableColumns: [],
  columnCategories: {},
  selectedColumns: [],
  variableConfigs: {},
  missingValueInfo: [],
  hasMissingValues: false,
  selectedMissingValueMethod: "remove" as MissingValueMethod,
  methodsByPairType: {
    "nominal-nominal": "cramers_v",
    "ordinal-ordinal": "spearman",
    "nominal-ordinal": "kruskal_wallis",
  },
  matrixResult: null,
  isLoading: false,
  error: null,
  currentStep: "select" as const,
};

export const useMultiCorrelationStore = create<MultiCorrelationState>(
  (set) => ({
    ...initialState,

    setDataSource: (userId, fileId) => set({ userId, fileId }),

    setAvailableColumns: (columns, categories) =>
      set({ availableColumns: columns, columnCategories: categories }),

    setSelectedColumns: (columns) =>
      set((state) => {
        // When columns change, only remove configs for deselected columns
        const newConfigs = { ...state.variableConfigs };
        Object.keys(newConfigs).forEach((col) => {
          if (!columns.includes(col)) {
            delete newConfigs[col];
          }
        });
        return {
          selectedColumns: columns,
          variableConfigs: newConfigs,
        };
      }),

    addColumn: (column) =>
      set((state) => ({
        selectedColumns: [...state.selectedColumns, column],
      })),

    removeColumn: (column) =>
      set((state) => {
        const newConfigs = { ...state.variableConfigs };
        delete newConfigs[column];
        return {
          selectedColumns: state.selectedColumns.filter((c) => c !== column),
          variableConfigs: newConfigs,
        };
      }),

    setVariableConfig: (columnName, config) =>
      set((state) => ({
        variableConfigs: { ...state.variableConfigs, [columnName]: config },
      })),

    setMissingValueInfo: (info, hasMissing) =>
      set({ missingValueInfo: info, hasMissingValues: hasMissing }),

    setMissingValueMethod: (method) =>
      set({ selectedMissingValueMethod: method }),

    setMethodForPairType: (pairType, method) =>
      set((state) => ({
        methodsByPairType: { ...state.methodsByPairType, [pairType]: method },
      })),

    setMatrixResult: (result) => set({ matrixResult: result }),

    setLoading: (loading) => set({ isLoading: loading }),

    setError: (error) => set({ error }),

    setCurrentStep: (step) => set({ currentStep: step }),

    reset: () =>
      set((state) => ({
        // Preserve data source and available columns so the selector still works
        userId: state.userId,
        fileId: state.fileId,
        availableColumns: state.availableColumns,
        columnCategories: state.columnCategories,
        // Everything else back to defaults
        selectedColumns: [],
        variableConfigs: {},
        missingValueInfo: [],
        hasMissingValues: false,
        selectedMissingValueMethod: initialState.selectedMissingValueMethod,
        methodsByPairType: { ...initialState.methodsByPairType },
        matrixResult: null,
        isLoading: false,
        error: null,
        currentStep: "select",
      })),
  }),
);
