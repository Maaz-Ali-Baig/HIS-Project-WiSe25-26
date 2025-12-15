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
}

export async function updateColumnSelection({
  userId,
  fileId,
  ranges,
}: UpdateColumnSelectionParams): Promise<FileDataResponse> {
  return apiFetch<FileDataResponse>("/api/files/selection", {
    method: "POST",
    body: JSON.stringify({ userId, fileId, ranges }),
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
