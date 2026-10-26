import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";

export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(env.authCookieName, token, authCookieOptions());
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(env.authCookieName, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax",
    path: "/",
  });
}