import { browser } from "$app/environment";
import { writable } from "svelte/store";

import type { AuthRole, AuthUser } from "$lib/api/types";

export type AuthSession = {
  token: string;
  user: AuthUser;
};

const storageKey = "course-enrollment.auth-session";

function getInitialSession() {
  if (!browser) {
    return null;
  }

  const rawValue = localStorage.getItem(storageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AuthSession>;

    if (
      typeof parsed?.token === "string" &&
      parsed.token.length > 0 &&
      parsed.user &&
      typeof parsed.user.id === "string" &&
      typeof parsed.user.name === "string" &&
      (parsed.user.role === "student" ||
        parsed.user.role === "instructor" ||
        parsed.user.role === "admin")
    ) {
      return parsed as AuthSession;
    }
  } catch {
    localStorage.removeItem(storageKey);
  }

  return null;
}

export const authSession = writable<AuthSession | null>(getInitialSession());

if (browser) {
  authSession.subscribe((value) => {
    if (value) {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } else {
      localStorage.removeItem(storageKey);
    }
  });
}

export function setAuthSession(session: AuthSession) {
  authSession.set(session);
}

export function clearAuthSession() {
  authSession.set(null);
}

export function getAuthHeaders(): Record<string, string> {
  if (!browser) {
    return {};
  }

  let token: string | null = null;

  authSession.subscribe((value) => {
    token = value?.token ?? null;
  })();

  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isRole(role: string): role is AuthRole {
  return role === "student" || role === "instructor" || role === "admin";
}
