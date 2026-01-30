import { apiFetch } from "../../../lib/http";

export interface FileUploadResponse {
  fileId: string;
  path: string;
  userId: string;
  filename: string;
}

export interface UploadFileParams {
  userId: string;
  username?: string;
  file: File;
}

export interface FileDataResponse {
  columns: string[];
  rows: Array<Record<string, string>>;
  updated_at: string;
  selectionRanges: Array<{ start: number; end: number }>;
  totalColumns: number;
  modifiedCells?: Array<{ rowId: string; column: string }>;
  summary?: DataReductionSummary;
  columnTypeFilter?: string;
}

export interface GetFileDataParams {
  userId: string;
  fileId: string;
}

export interface FileEdit {
  rowId: string;
  changes: Record<string, string>;
}

export interface UpdateFileDataParams {
  userId: string;
  fileId: string;
  edits: FileEdit[];
}

export async function uploadFile({
  userId,
  username,
  file,
}: UploadFileParams): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append("user_id", userId);
  if (username) {
    formData.append("username", username);
  }
  formData.append("file", file);

  return apiFetch<FileUploadResponse>("/api/files/upload", {
    method: "POST",
    body: formData,
  });
}

export async function getFileData({
  userId,
  fileId,
}: GetFileDataParams): Promise<FileDataResponse> {
  return apiFetch<FileDataResponse>(
    `/api/files/data?userId=${encodeURIComponent(userId)}&fileId=${encodeURIComponent(fileId)}`,
  );
}

export async function updateFileData({
  userId,
  fileId,
  edits,
}: UpdateFileDataParams): Promise<FileDataResponse> {
  return apiFetch<FileDataResponse>("/api/files/data", {
    method: "PUT",
    body: JSON.stringify({ userId, fileId, edits }),
  });
}

export interface UpdateColumnSelectionParams {
  userId: string;
  fileId: string;
  ranges: Array<{ start: number; end: number }>;
  columnTypeFilter?: string;
}

export async function updateColumnSelection({
  userId,
  fileId,
  ranges,
  columnTypeFilter = "all",
}: UpdateColumnSelectionParams): Promise<FileDataResponse> {
  return apiFetch<FileDataResponse>("/api/files/selection", {
    method: "POST",
    body: JSON.stringify({ userId, fileId, ranges, columnTypeFilter }),
  });
}

export interface HandleMissingValuesParams {
  userId: string;
  fileId: string;
  selected_columns: string[];
  selected_method: string;
}

export async function handleMissingValues({
  userId,
  fileId,
  selected_columns,
  selected_method,
}: HandleMissingValuesParams): Promise<FileDataResponse> {
  return apiFetch<FileDataResponse>("/api/files/missing-values", {
    method: "POST",
    body: JSON.stringify({ userId, fileId, selected_columns, selected_method }),
  });
}

export interface HandleBinningParams {
  userId: string;
  fileId: string;
  selected_columns: string[];
  method: string;
  n_bins?: number;
  min_freq?: number;
  target_column?: string;
  custom_mapping?: Record<string, string[]>;
  similarity_threshold?: number;
  // Legacy parameters
  bin_labels?: string[];
  smooth_window?: number;
  breaks?: number[];
}

export async function handleBinning({
  userId,
  fileId,
  selected_columns,
  method,
  n_bins = 5,
  min_freq = 10,
  target_column,
  custom_mapping,
  similarity_threshold = 0.7,
  bin_labels,
  smooth_window = 3,
  breaks,
}: HandleBinningParams): Promise<FileDataResponse> {
  return apiFetch<FileDataResponse>("/api/files/binning", {
    method: "POST",
    body: JSON.stringify({
      userId,
      fileId,
      selected_columns,
      method,
      n_bins,
      min_freq,
      target_column,
      custom_mapping,
      similarity_threshold,
      bin_labels,
      smooth_window,
      breaks,
    }),
  });
}

export interface HandleEncodingParams {
  userId: string;
  fileId: string;
  selected_columns: string[];
  method: string;
  target_columns?: string[];
}

export async function handleEncoding({
  userId,
  fileId,
  selected_columns,
  method,
  target_columns,
}: HandleEncodingParams): Promise<FileDataResponse> {
  return apiFetch<FileDataResponse>("/api/files/encoding", {
    method: "POST",
    body: JSON.stringify({
      userId,
      fileId,
      selected_columns,
      method,
      target_columns,
    }),
  });
}

export interface HandleTextTransformationParams {
  userId: string;
  fileId: string;
  selected_columns: string[];
  k?: number;
}

export async function handleTextTransformation({
  userId,
  fileId,
  selected_columns,
  k,
}: HandleTextTransformationParams): Promise<FileDataResponse> {
  return apiFetch<FileDataResponse>("/api/files/text-transformation", {
    method: "POST",
    body: JSON.stringify({
      userId,
      fileId,
      selected_columns,
      k,
    }),
  });
}

export interface HandleDataReductionParams {
  userId: string;
  fileId: string;
  selected_columns: string[];
  method: "auto" | "mca" | "famd";
  n_components: number;
  rare_threshold?: number;
  max_cardinality?: number;
  sample_size?: number;
}

export interface DroppedColumn {
  column: string;
  reason: string;
  uniqueLevels?: number;
  threshold?: number;
}

export interface MissingHandling {
  categoricalBlankOrNAReplacedWith?: string;
}

export interface RareLevelHandling {
  rareThreshold?: number;
  rareLevelsReplacedWith?: string;
}

export interface TopContributions {
  [key: string]: string[];
}

export interface DroppedColumn {
  column: string;
  reason: string;
  uniqueLevels?: number;
  threshold?: number;
}

export interface MissingHandling {
  categoricalBlankOrNAReplacedWith?: string;
}

export interface RareLevelHandling {
  rareThreshold?: number;
  rareLevelsReplacedWith?: string;
}

export interface DataReductionSummary {
  method?: string;
  components?: number;
  inputColumns?: number;
  originalColumns?: number;
  drColumns?: number;
  outputColumns?: number;
  varianceExplained?: number[];
  totalVariance?: number;
  selectedColumns?: string[];
  rowsInput?: number;
  rowsUsedForFit?: number;
  seedUsed?: number | null;
  droppedColumns?: DroppedColumn[];
  missingHandling?: MissingHandling;
  rareLevelHandling?: RareLevelHandling;
  drColumnNames?: string[];
  topContributingVariables?: { [key: string]: string[] };
}

export interface DataReductionResponse extends FileDataResponse {
  summary?: DataReductionSummary;
}

export async function handleDataReduction({
  userId,
  fileId,
  selected_columns,
  method,
  n_components,
  rare_threshold,
  max_cardinality,
  sample_size,
}: HandleDataReductionParams): Promise<DataReductionResponse> {
  return apiFetch<DataReductionResponse>("/api/files/data-reduction", {
    method: "POST",
    body: JSON.stringify({
      userId,
      fileId,
      selected_columns,
      method,
      n_components,
      rare_threshold,
      max_cardinality,
      sample_size,
    }),
  });
}
export interface FileStatsResponse {
  total_rows: number;
  total_columns: number;
  categorical_columns: number;
  numeric_columns: number;
  text_columns: number;
  datetime_columns: number;
  other_columns: number;
  missing_value_percentage: number;
}

export interface GetFileStatsParams {
  userId: string;
  fileId: string;
}

export async function getFileStats({
  userId,
  fileId,
}: GetFileStatsParams): Promise<FileStatsResponse> {
  const params = new URLSearchParams({
    userId,
    fileId,
  });

  return apiFetch<FileStatsResponse>(`/api/files/stats?${params.toString()}`, {
    method: "GET",
  });
}



