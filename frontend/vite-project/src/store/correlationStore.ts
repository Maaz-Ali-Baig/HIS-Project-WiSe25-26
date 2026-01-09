/**
 * Correlation Store (Two-Column Analysis)
 * Manages state for simple two-variable correlation analysis
 */
import { create } from "zustand";
import type {
  VariableConfig,
  CorrelationMethod,
  CorrelationResult,
  VariableType,
} from "../features/home/api/correlation";

interface CorrelationState {
  // Data source
  userId: string | null;
  fileId: string | null;

  // Available data
  availableColumns: string[];
  columnCategories: Record<string, string[]>;

  // Variable selection
  selectedColumn1: string | null;
  selectedColumn2: string | null;

  // Variable configuration
  variable1Config: VariableConfig | null;
  variable2Config: VariableConfig | null;

  // Method selection
  availableMethods: CorrelationMethod[];
  selectedMethod: string | null;

  // Results
  result: CorrelationResult | null;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setDataSource: (userId: string, fileId: string) => void;
  setAvailableColumns: (
    columns: string[],
    categories: Record<string, string[]>,
  ) => void;
  setSelectedColumn1: (column: string | null) => void;
  setSelectedColumn2: (column: string | null) => void;
  setVariable1Config: (config: VariableConfig | null) => void;
  setVariable2Config: (config: VariableConfig | null) => void;
  setAvailableMethods: (methods: CorrelationMethod[]) => void;
  setSelectedMethod: (method: string | null) => void;
  setResult: (result: CorrelationResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  userId: null,
  fileId: null,
  availableColumns: [],
  columnCategories: {},
  selectedColumn1: null,
  selectedColumn2: null,
  variable1Config: null,
  variable2Config: null,
  availableMethods: [],
  selectedMethod: null,
  result: null,
  isLoading: false,
  error: null,
};

export const useCorrelationStore = create<CorrelationState>((set) => ({
  ...initialState,

  setDataSource: (userId, fileId) => set({ userId, fileId }),

  setAvailableColumns: (columns, categories) =>
    set({ availableColumns: columns, columnCategories: categories }),

  setSelectedColumn1: (column) =>
    set({ selectedColumn1: column, variable1Config: null }),

  setSelectedColumn2: (column) =>
    set({ selectedColumn2: column, variable2Config: null }),

  setVariable1Config: (config) => set({ variable1Config: config }),

  setVariable2Config: (config) => set({ variable2Config: config }),

  setAvailableMethods: (methods) =>
    set({
      availableMethods: methods,
      selectedMethod: methods.length > 0 ? methods[0].value : null,
    }),

  setSelectedMethod: (method) => set({ selectedMethod: method }),

  setResult: (result) => set({ result }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
