const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface ApiFetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export async function apiFetch<T = any>(
  path: string,
  options?: ApiFetchOptions
): Promise<T> {
  const url = `${baseURL}${path}`;

  // Detect if body is FormData and skip Content-Type header (browser sets it automatically with boundary)
  const isFormData = options?.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(options?.headers || {}),
  };

  // Only add Content-Type for non-FormData requests
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    credentials: 'include',
    headers,
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: response.statusText,
    }));
    
    // Handle different error formats
    let errorMessage = 'An error occurred';
    if (typeof error.detail === 'string') {
      errorMessage = error.detail;
    } else if (error.detail && typeof error.detail === 'object') {
      errorMessage = JSON.stringify(error.detail);
    } else if (error.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}
