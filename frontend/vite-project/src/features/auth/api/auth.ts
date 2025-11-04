import { apiFetch } from '../../../lib/http';

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    created_at: string;
  };
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

interface RegisterRequest {
  username: string;
  password: string;
}

interface RegisterResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    created_at: string;
  };
}

export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
