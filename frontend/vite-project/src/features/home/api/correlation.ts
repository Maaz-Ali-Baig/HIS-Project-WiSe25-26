/**
 * Correlation Analysis API Client
 * Provides TypeScript-typed API calls to the correlation backend
 */
import axios from "axios";

const API_BASE_URL = "http://localhost:8000/api/correlation";

// ==================== Type Definitions ====================

export type VariableType = "nominal" | "ordinal";
export type MissingValueMethod =
  | "remove"
  | "mode"
  | "median"
  | "missing_category";

export interface VariableConfig {
  columnName: string;
  type: VariableType;
  categories: string[];
  ordering?: Record<string, number> | null;
}

export interface CorrelationMethod {
  value: string;
  label: string;
  description: string;
}

export interface CorrelationResult {
  method: string;
  method_name: string;
  result: {
    effect_size?: number;
    statistic?: number;
    p_value: number;
    interpretation?: string;
    confidence_interval?: [number, number];
  };
  sample_size: number;
  removed_rows: number;
  missing_category_rows?: number;
  variable1_name: string;
  variable2_name: string;
}

export interface ColumnInfo {
  columnName: string;
  missingCount: number;
  totalCount: number;
  missingPercentage: number;
}

export interface MissingValueResponse {
  hasMissing: boolean;
  columnsInfo: ColumnInfo[];
}

export interface MatrixCell {
  row: number;
  col: number;
  row_name: string;
  col_name: string;
  correlation: number;
  p_value: number;
  method: string;
  is_diagonal: boolean;
}

export interface MatrixAnalysisResult {
  matrix: MatrixCell[][];
  columns: string[];
  pairDetails: Record<string, CorrelationResult>;
}

export interface HealthCheckResponse {
  status: "healthy" | "degraded";
  r_installed: boolean;
  message: string;
}

export interface ColumnsResponse {
  columns: string[];
  categories: Record<string, string[]>;
}

// ==================== API Functions ====================

/**
 * Check R installation and service health
 */
export async function checkHealth(): Promise<HealthCheckResponse> {
  const response = await axios.get<HealthCheckResponse>(
    `${API_BASE_URL}/health`,
  );
  return response.data;
}

/**
 * Get available columns and their categories from user's dataset
 */
export async function getColumns(
  userId: string,
  fileId: string,
): Promise<ColumnsResponse> {
  const response = await axios.get<ColumnsResponse>(`${API_BASE_URL}/columns`, {
    params: { userId, fileId },
  });
  return response.data;
}

/**
 * Get available correlation methods for given variable types
 */
export async function getMethods(
  type1: VariableType,
  type2: VariableType,
): Promise<CorrelationMethod[]> {
  const response = await axios.get<{ methods: CorrelationMethod[] }>(
    `${API_BASE_URL}/methods`,
    {
      params: { type1, type2 },
    },
  );
  return response.data.methods;
}

/**
 * Perform correlation analysis on two variables
 */
export async function analyzeCorrelation(request: {
  userId: string;
  fileId: string;
  variable1: VariableConfig;
  variable2: VariableConfig;
  method: string;
}): Promise<CorrelationResult> {
  const response = await axios.post<CorrelationResult>(
    `${API_BASE_URL}/analyze`,
    request,
  );
  return response.data;
}

/**
 * Check for missing values in specified columns
 */
export async function checkMissingValues(request: {
  userId: string;
  fileId: string;
  columns: string[];
}): Promise<MissingValueResponse> {
  const response = await axios.post<MissingValueResponse>(
    `${API_BASE_URL}/check-missing`,
    request,
  );
  return response.data;
}

/**
 * Perform correlation matrix analysis on multiple columns
 */
export async function analyzeCorrelationMatrix(request: {
  userId: string;
  fileId: string;
  columns: string[];
  variableConfigs: Record<string, VariableConfig>;
  missingValueMethod: MissingValueMethod;
  methodsByPairType: Record<string, string>;
}): Promise<MatrixAnalysisResult> {
  const response = await axios.post<MatrixAnalysisResult>(
    `${API_BASE_URL}/analyze-matrix`,
    request,
  );
  return response.data;
}

/**
 * Helper: Determine pair type from two variable types
 */
export function getPairType(type1: VariableType, type2: VariableType): string {
  if (type1 === "nominal" && type2 === "nominal") {
    return "nominal-nominal";
  } else if (type1 === "ordinal" && type2 === "ordinal") {
    return "ordinal-ordinal";
  } else {
    return "nominal-ordinal";
  }
}
