import Cookies from 'js-cookie';

const TOKEN_NAME = 'accessToken';

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_NAME);
}

export function setToken(token: string, options?: { remember?: boolean }): void {
  const cookieOptions: Cookies.CookieAttributes = {
    path: '/',
    sameSite: 'Lax',
  };

  if (options?.remember) {
    cookieOptions.expires = 7; // 7 days
  }
  // If remember is false/undefined, it's a session cookie (expires when browser closes)

  Cookies.set(TOKEN_NAME, token, cookieOptions);
}

export function clearToken(): void {
  Cookies.remove(TOKEN_NAME, { path: '/' });
}
