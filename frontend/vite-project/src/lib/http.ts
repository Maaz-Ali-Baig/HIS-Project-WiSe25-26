const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface ApiFetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export async function apiFetch<T = any>(
  path: string,
  options?: ApiFetchOptions
): Promise<T> {
  const url = `${baseURL}${path}`;

  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: response.statusText,
    }));
    throw new Error(error.detail || 'An error occurred');
  }

  return response.json();
}
