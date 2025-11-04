import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { getToken, setToken, clearToken } from '../lib/cookies';

interface User {
  id: string;
  username: string;
  created_at?: string;
}

interface AuthState {
  token?: string;
  user?: User;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (data: { token: string; user: User; remember?: boolean }) => void;
  logout: () => void;
  hydrateFromCookie: () => void;
}

interface JWTPayload {
  user_id: string;
  username: string;
  exp?: number;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  token: undefined,
  user: undefined,
  isAuthenticated: false,

  login: ({ token, user, remember }) => {
    setToken(token, { remember });
    set({
      token,
      user,
      isAuthenticated: true,
    });
  },

  logout: () => {
    clearToken();
    set({
      token: undefined,
      user: undefined,
      isAuthenticated: false,
    });
  },

  hydrateFromCookie: () => {
    const token = getToken();
    if (token) {
      try {
        const decoded = jwtDecode<JWTPayload>(token);

        // Check if token is expired (only if exp is present)
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          clearToken();
          return;
        }

        set({
          token,
          user: {
            id: decoded.user_id,
            username: decoded.username,
            // created_at is omitted on reload per Q24=a
          },
          isAuthenticated: true,
        });
      } catch (error) {
        // Invalid token, clear it
        clearToken();
      }
    }
  },
}));
