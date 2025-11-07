import { apiFetch } from '../../../lib/http';

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
}

export interface GetFileDataParams {
  userId: string;
  fileId: string;
}

export async function uploadFile({
  userId,
  username,
  file,
}: UploadFileParams): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append('user_id', userId);
  if (username) {
    formData.append('username', username);
  }
  formData.append('file', file);

  return apiFetch<FileUploadResponse>('/api/files/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function getFileData({
  userId,
  fileId,
}: GetFileDataParams): Promise<FileDataResponse> {
  return apiFetch<FileDataResponse>(
    `/api/files/data?userId=${encodeURIComponent(userId)}&fileId=${encodeURIComponent(fileId)}`
  );
}
