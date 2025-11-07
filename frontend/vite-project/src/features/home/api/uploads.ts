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
