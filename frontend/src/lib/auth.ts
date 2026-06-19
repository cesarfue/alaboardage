const TOKEN_KEY = 'token';

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Decode the JWT payload without signature verification — display only. */
export function getUser(): AuthUser | null {
  const token = getToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1])) as AuthUser;
    return payload;
  } catch {
    return null;
  }
}
