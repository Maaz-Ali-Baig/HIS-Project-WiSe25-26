import axios from 'axios';
import type { VariableConfig, CorrelationResult, CorrelationMethod } from '@/store/correlationStore';
import type { MatrixCell, MissingValueInfo } from '@/store/multiCorrelationStore';

const API_BASE_URL = 'http://localhost:8000';

export interface ColumnInfoResponse {
  columns: string[];
  categories: Record<string, string[]>;
}

export interface CorrelationRequest {
  userId: string;
  fileId: string;
  variable1: VariableConfig;
  variable2: VariableConfig;
  method: string;
}

export interface MethodsResponse {
  methods: CorrelationMethod[];
}

export interface HealthResponse {
  status: string;
  r_installed: boolean;
  message: string;
}

/**
 * Check if the correlation analysis service is healthy and R is installed
 */
export const checkCorrelationHealth = async (): Promise<HealthResponse> => {
  try {
    const response = await axios.get<HealthResponse>(
      `${API_BASE_URL}/api/correlation/health`
    );
    return response.data;
  } catch (error) {
    console.error('Error checking correlation health:', error);
    throw error;
  }
};

/**
 * Get available columns and their categories from the selected dataset
 */
export const getColumnInfo = async (
  userId: string,
  fileId: string
): Promise<ColumnInfoResponse> => {
  try {
    const response = await axios.get<ColumnInfoResponse>(
      `${API_BASE_URL}/api/correlation/columns`,
      {
        params: { userId, fileId },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching column info:', error);
    throw error;
  }
};

/**
 * Get available correlation methods based on variable types
 */
export const getAvailableMethods = async (
  type1: 'nominal' | 'ordinal',
  type2: 'nominal' | 'ordinal'
): Promise<MethodsResponse> => {
  try {
    const response = await axios.get<MethodsResponse>(
      `${API_BASE_URL}/api/correlation/methods`,
      {
        params: { type1, type2 },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching available methods:', error);
    throw error;
  }
};

/**
 * Perform correlation analysis on two variables
 */
export const analyzeCorrelation = async (
  request: CorrelationRequest
): Promise<CorrelationResult> => {
  try {
    const response = await axios.post<CorrelationResult>(
      `${API_BASE_URL}/api/correlation/analyze`,
      request
    );
    return response.data;
  } catch (error) {
    console.error('Error performing correlation analysis:', error);
    throw error;
  }
};

// Multi-column correlation interfaces
export interface MultiColumnCorrelationRequest {
  userId: string;
  fileId: string;
  columns: string[];
  variableConfigs: Record<string, VariableConfig>;
  missingValueMethod: 'remove' | 'mode' | 'median' | 'missing_category';
  methodsByPairType: {
    'nominal-nominal': string;
    'ordinal-ordinal': string;
    'nominal-ordinal': string;
  };
}

export interface CorrelationMatrixResponse {
  matrix: MatrixCell[][];
  columns: string[];
  pairDetails: Record<string, CorrelationResult>;
}

export interface MissingValuesCheckResponse {
  hasMissing: boolean;
  columnsInfo: MissingValueInfo[];
}

/**
 * Check for missing values in selected columns
 */
export const checkMissingValues = async (
  userId: string,
  fileId: string,
  columns: string[]
): Promise<MissingValuesCheckResponse> => {
  try {
    console.log('checkMissingValues API call with:', { userId, fileId, columns });
    
    const response = await axios.post<MissingValuesCheckResponse>(
      `${API_BASE_URL}/api/correlation/check-missing`,
      { userId, fileId, columns }
    );
    
    console.log('checkMissingValues API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error checking missing values:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    throw error;
  }
};

/**
 * Perform multi-column correlation analysis and get correlation matrix
 */
export const analyzeCorrelationMatrix = async (
  request: MultiColumnCorrelationRequest
): Promise<CorrelationMatrixResponse> => {
  try {
    const response = await axios.post<CorrelationMatrixResponse>(
      `${API_BASE_URL}/api/correlation/analyze-matrix`,
      request
    );
    return response.data;
  } catch (error) {
    console.error('Error performing matrix correlation analysis:', error);
    throw error;
  }
};
