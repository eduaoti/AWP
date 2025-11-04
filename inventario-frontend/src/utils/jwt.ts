import { jwtDecode } from "jwt-decode";

export type Decoded = { exp?: number; sub?: number; rol?: string; jti?: string };

export function decodeExp(token?: string | null) {
  if (!token) return undefined;
  try {
    return (jwtDecode(token) as Decoded).exp;
  } catch {
    return undefined;
  }
}

export function msUntilExp(exp?: number) {
  if (!exp) return undefined;
  return Math.max(0, exp * 1000 - Date.now());
}
