import { create } from 'zustand';
import { checkMissingValues, analyzeCorrelationMatrix } from '@/features/home/api/correlation';
import type { MultiColumnCorrelationRequest } from '@/features/home/api/correlation';

export interface VariableConfig {
  columnName: string;
  type: 'nominal' | 'ordinal';
  categories: string[];
  ordering: Record<string, number> | null;
}

export interface CorrelationResult {
  method: string;
  method_name: string;
  result: Record<string, any>;
  sample_size: number;
  removed_rows: number;
  missing_category_rows?: number;
  variable1_name: string;
  variable2_name: string;
}

export interface MatrixCell {
  row: number;
  col: number;
  row_name: string;
  col_name: string;
  correlation: number | null;
  p_value: number | null;
  method: string | null;
  is_diagonal: boolean;
}

export interface MissingValueInfo {
  columnName: string;
  missingCount: number;
  totalCount: number;
  missingPercentage: number;
}

interface MultiCorrelationStore {
  // Multi-column selection
  selectedColumns: string[];
  availableColumns: string[];
  allCategories: Record<string, string[]>;
  
  // Variable configurations for ALL selected columns
  variableConfigs: Record<string, VariableConfig>;
  
  // Missing value handling
  missingValueMethod: 'remove' | 'mode' | 'median' | 'missing_category';
  missingInfo: MissingValueInfo[];
  showMissingHandler: boolean;
  
  // Method selection by pair type
  methodsByPairType: {
    'nominal-nominal': string;
    'ordinal-ordinal': string;
    'nominal-ordinal': string;
  };
  availableMethodsByType: Record<string, Array<{value: string; label: string; description: string}>>;
  
  // Correlation matrix results (column-name indexed for easy lookup)
  correlationMatrix: Record<string, Record<string, MatrixCell>> | null;
  matrixColumns: string[]; // Ordered list of columns in matrix
  pairDetails: Record<string, CorrelationResult>;
  selectedCell: { row: string; col: string } | null;
  
  // File context
  userId: string;
  fileId: string;
  
  // UI state
  currentStep: 'select' | 'configure' | 'missing' | 'methods' | 'results';
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setFileContext: (userId: string, fileId: string) => void;
  setAvailableColumns: (columns: string[], categories: Record<string, string[]>) => void;
  toggleColumnSelection: (column: string) => void;
  setSelectedColumns: (columns: string[]) => void;
  
  setVariableType: (columnName: string, type: 'nominal' | 'ordinal') => void;
  setVariableOrdering: (columnName: string, ordering: Record<string, number>) => void;
  
  setMissingValueMethod: (method: 'remove' | 'mode' | 'median' | 'missing_category') => void;
  setMissingInfo: (info: MissingValueInfo[]) => void;
  setShowMissingHandler: (show: boolean) => void;
  
  setMethodForPairType: (pairType: 'nominal-nominal' | 'ordinal-ordinal' | 'nominal-ordinal', method: string) => void;
  setAvailableMethodsByType: (pairType: string, methods: Array<{value: string; label: string; description: string}>) => void;
  
  setCorrelationMatrix: (matrix: Record<string, Record<string, MatrixCell>>, pairDetails: Record<string, CorrelationResult>) => void;
  setSelectedCell: (cell: { row: string; col: string } | null) => void;
  
  setCurrentStep: (step: 'select' | 'configure' | 'missing' | 'methods' | 'results') => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Workflow methods
  checkMissing: () => Promise<void>;
  analyzeMatrix: () => Promise<void>;
  
  reset: () => void;
}

const initialState = {
  selectedColumns: [],
  availableColumns: [],
  allCategories: {},
  variableConfigs: {},
  missingValueMethod: 'remove' as const,
  missingInfo: [],
  showMissingHandler: false,
  methodsByPairType: {
    'nominal-nominal': 'chi_square',
    'ordinal-ordinal': 'spearman',
    'nominal-ordinal': 'anova_eta',
  },
  availableMethodsByType: {},
  correlationMatrix: null,
  matrixColumns: [],
  pairDetails: {},
  selectedCell: null,
  userId: '',
  fileId: '',
  currentStep: 'select' as const,
  isLoading: false,
  error: null,
};

export const useMultiCorrelationStore = create<MultiCorrelationStore>((set, get) => ({
  ...initialState,
  
  setFileContext: (userId, fileId) => set({ userId, fileId }),
  
  setAvailableColumns: (columns, categories) =>
    set({ availableColumns: columns, allCategories: categories }),
  
  toggleColumnSelection: (column) =>
    set((state) => {
      const isSelected = state.selectedColumns.includes(column);
      const newSelected = isSelected
        ? state.selectedColumns.filter((c) => c !== column)
        : [...state.selectedColumns, column];
      
      // Initialize config for newly selected column
      const newConfigs = { ...state.variableConfigs };
      if (!isSelected && state.allCategories[column]) {
        newConfigs[column] = {
          columnName: column,
          type: 'nominal',
          categories: state.allCategories[column],
          ordering: null,
        };
      } else if (isSelected) {
        delete newConfigs[column];
      }
      
      return {
        selectedColumns: newSelected,
        variableConfigs: newConfigs,
      };
    }),
  
  setSelectedColumns: (columns) =>
    set((state) => {
      const newConfigs: Record<string, VariableConfig> = {};
      columns.forEach((col) => {
        if (state.allCategories[col]) {
          newConfigs[col] = state.variableConfigs[col] || {
            columnName: col,
            type: 'nominal',
            categories: state.allCategories[col],
            ordering: null,
          };
        }
      });
      return {
        selectedColumns: columns,
        variableConfigs: newConfigs,
      };
    }),
  
  setVariableType: (columnName, type) =>
    set((state) => {
      const config = state.variableConfigs[columnName];
      if (!config) return state;
      
      const newConfig = { ...config, type };
      if (type === 'ordinal') {
        // Initialize default ordering
        const defaultOrdering: Record<string, number> = {};
        config.categories.forEach((cat, idx) => {
          defaultOrdering[cat] = idx + 1;
        });
        newConfig.ordering = defaultOrdering;
      } else {
        newConfig.ordering = null;
      }
      
      return {
        variableConfigs: {
          ...state.variableConfigs,
          [columnName]: newConfig,
        },
      };
    }),
  
  setVariableOrdering: (columnName, ordering) =>
    set((state) => ({
      variableConfigs: {
        ...state.variableConfigs,
        [columnName]: {
          ...state.variableConfigs[columnName],
          ordering,
        },
      },
    })),
  
  setMissingValueMethod: (method) => set({ missingValueMethod: method }),
  setMissingInfo: (info) => set({ missingInfo: info }),
  setShowMissingHandler: (show) => set({ showMissingHandler: show }),
  
  setMethodForPairType: (pairType, method) =>
    set((state) => ({
      methodsByPairType: {
        ...state.methodsByPairType,
        [pairType]: method,
      },
    })),
  
  setAvailableMethodsByType: (pairType, methods) =>
    set((state) => ({
      availableMethodsByType: {
        ...state.availableMethodsByType,
        [pairType]: methods,
      },
    })),
  
  setCorrelationMatrix: (matrix, pairDetails) =>
    set({ correlationMatrix: matrix, pairDetails }),
  
  setSelectedCell: (cell) => set({ selectedCell: cell }),
  
  setCurrentStep: (step) => set({ currentStep: step }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  // Workflow methods
  checkMissing: async () => {
    const state = get();
    
    console.log('checkMissing called with:', {
      userId: state.userId,
      fileId: state.fileId,
      selectedColumns: state.selectedColumns
    });
    
    if (!state.userId || !state.fileId) {
      const errorMsg = 'Missing required context: userId or fileId not set';
      console.error(errorMsg);
      set({ error: errorMsg });
      return;
    }
    
    if (state.selectedColumns.length === 0) {
      const errorMsg = 'No columns selected';
      console.error(errorMsg);
      set({ error: errorMsg });
      return;
    }
    
    try {
      set({ isLoading: true, error: null });
      console.log('Calling checkMissingValues API...');
      
      const response = await checkMissingValues(
        state.userId,
        state.fileId,
        state.selectedColumns
      );
      
      console.log('checkMissingValues response:', response);
      
      set({
        missingInfo: response.columnsInfo,
        showMissingHandler: response.hasMissing,
        isLoading: false,
      });
      
      // Auto-advance to next step
      if (response.hasMissing) {
        console.log('Missing values detected, advancing to missing step');
        set({ currentStep: 'missing' });
      } else {
        console.log('No missing values, advancing to methods step');
        set({ currentStep: 'methods' });
      }
    } catch (error) {
      console.error('Error in checkMissing:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to check missing values';
      set({
        error: errorMsg,
        isLoading: false,
      });
    }
  },
  
  analyzeMatrix: async () => {
    const state = get();
    if (!state.userId || !state.fileId) {
      set({ error: 'Missing userId or fileId' });
      return;
    }
    
    try {
      set({ isLoading: true, error: null });
      
      const request: MultiColumnCorrelationRequest = {
        userId: state.userId,
        fileId: state.fileId,
        columns: state.selectedColumns,
        variableConfigs: state.variableConfigs,
        missingValueMethod: state.missingValueMethod,
        methodsByPairType: state.methodsByPairType,
      };
      
      const response = await analyzeCorrelationMatrix(request);
      
      // Convert matrix array to nested object for easier lookup
      const matrixObj: Record<string, Record<string, MatrixCell>> = {};
      response.matrix.forEach((row) => {
        row.forEach((cell) => {
          if (!matrixObj[cell.row_name]) {
            matrixObj[cell.row_name] = {};
          }
          matrixObj[cell.row_name][cell.col_name] = cell;
        });
      });
      
      set({
        correlationMatrix: matrixObj,
        matrixColumns: response.columns,
        pairDetails: response.pairDetails,
        currentStep: 'results',
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to analyze correlations',
        isLoading: false,
      });
    }
  },
  
  reset: () => set(initialState),
}));
