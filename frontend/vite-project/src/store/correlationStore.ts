import { create } from 'zustand';

export interface VariableConfig {
  columnName: string;
  type: 'nominal' | 'ordinal';
  categories: string[];
  ordering: Record<string, number> | null;
}

export interface CorrelationResult {
  method: string;
  method_name: string;
  result: {
    statistic?: number;
    p_value?: number;
    df?: number;
    f_statistic?: number;
    h_statistic?: number;
    eta_squared?: number;
    epsilon_squared?: number;
    z_value?: number;
    confidence_interval?: number[];
    df_between?: number;
    df_within?: number;
    interpretation: string;
  };
  sample_size: number;
  removed_rows: number;
  missing_category_rows?: number;
  variable1_name: string;
  variable2_name: string;
}

export interface CorrelationMethod {
  value: string;
  label: string;
  description: string;
}

interface CorrelationState {
  // Column selection
  selectedColumns: {
    col1: string | null;
    col2: string | null;
  };
  availableColumns: string[];
  allCategories: Record<string, string[]>;
  
  // Variable configuration
  variableConfigs: {
    col1: VariableConfig | null;
    col2: VariableConfig | null;
  };
  
  // Method selection
  availableMethods: CorrelationMethod[];
  selectedMethod: string | null;
  
  // Results
  results: CorrelationResult | null;
  isAnalyzing: boolean;
  error: string | null;
  
  // Current tab
  currentTab: 'configuration' | 'results';
  
  // Actions
  setSelectedColumn: (columnKey: 'col1' | 'col2', columnName: string) => void;
  setAvailableColumns: (columns: string[], categories: Record<string, string[]>) => void;
  setVariableConfig: (columnKey: 'col1' | 'col2', config: VariableConfig) => void;
  setVariableType: (columnKey: 'col1' | 'col2', type: 'nominal' | 'ordinal') => void;
  setVariableOrdering: (columnKey: 'col1' | 'col2', ordering: Record<string, number>) => void;
  setAvailableMethods: (methods: CorrelationMethod[]) => void;
  setSelectedMethod: (method: string) => void;
  setResults: (results: CorrelationResult | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentTab: (tab: 'configuration' | 'results') => void;
  reset: () => void;
  resetResults: () => void;
}

const initialState = {
  selectedColumns: {
    col1: null,
    col2: null,
  },
  availableColumns: [],
  allCategories: {},
  variableConfigs: {
    col1: null,
    col2: null,
  },
  availableMethods: [],
  selectedMethod: null,
  results: null,
  isAnalyzing: false,
  error: null,
  currentTab: 'configuration' as const,
};

export const useCorrelationStore = create<CorrelationState>((set) => ({
  ...initialState,
  
  setSelectedColumn: (columnKey, columnName) => {
    set((state) => {
      const newSelectedColumns = { ...state.selectedColumns, [columnKey]: columnName };
      const categories = state.allCategories[columnName] || [];
      
      // Initialize variable config when column is selected
      const newConfig: VariableConfig = {
        columnName,
        type: 'nominal',
        categories,
        ordering: null,
      };
      
      return {
        selectedColumns: newSelectedColumns,
        variableConfigs: {
          ...state.variableConfigs,
          [columnKey]: newConfig,
        },
      };
    });
  },
  
  setAvailableColumns: (columns, categories) => {
    set({
      availableColumns: columns,
      allCategories: categories,
    });
  },
  
  setVariableConfig: (columnKey, config) => {
    set((state) => ({
      variableConfigs: {
        ...state.variableConfigs,
        [columnKey]: config,
      },
    }));
  },
  
  setVariableType: (columnKey, type) => {
    set((state) => {
      const currentConfig = state.variableConfigs[columnKey];
      if (!currentConfig) return state;
      
      return {
        variableConfigs: {
          ...state.variableConfigs,
          [columnKey]: {
            ...currentConfig,
            type,
            ordering: type === 'ordinal' ? {} : null,
          },
        },
      };
    });
  },
  
  setVariableOrdering: (columnKey, ordering) => {
    set((state) => {
      const currentConfig = state.variableConfigs[columnKey];
      if (!currentConfig) return state;
      
      return {
        variableConfigs: {
          ...state.variableConfigs,
          [columnKey]: {
            ...currentConfig,
            ordering,
          },
        },
      };
    });
  },
  
  setAvailableMethods: (methods) => {
    set({ availableMethods: methods });
  },
  
  setSelectedMethod: (method) => {
    set({ selectedMethod: method });
  },
  
  setResults: (results) => {
    set({ results, error: null });
  },
  
  setIsAnalyzing: (analyzing) => {
    set({ isAnalyzing: analyzing });
  },
  
  setError: (error) => {
    set({ error, isAnalyzing: false });
  },
  
  setCurrentTab: (tab) => {
    set({ currentTab: tab });
  },
  
  reset: () => {
    set(initialState);
  },
  
  resetResults: () => {
    set({ results: null, error: null, currentTab: 'configuration' });
  },
}));
