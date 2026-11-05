import crypto from "crypto";
import { findOrCreateUser as upsertUser, type User } from "../db/models/User";
import {
  createSession as insertSession,
  deleteAllUserSessions as removeAllUserSessions,
  deleteExpiredSessions,
  deleteSession as removeSession,
  findSessionWithUser,
  getSessionByToken,
  updateWCATokens,
} from "../db/models/Session";

const SESSION_DURATION_DAYS = 30;

// WCA OAuth config — read from env at runtime
function getWCAConfig() {
  return {
    WCA_URL: process.env.WCA_URL || "https://www.worldcubeassociation.org",
    APPLICATION_ID: process.env.WCA_APPLICATION_ID || "",
    APPLICATION_SECRET: process.env.WCA_APPLICATION_SECRET || "",
    REDIRECT_URI: process.env.WCA_REDIRECT_URI || "http://localhost:5173",
  };
}

// --- WCA OAuth Types ---

interface WCAOauthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  created_at: number;
  scope: string;
}

interface WCAUserResponseInfo {
  me: {
    id: number;
    wca_id: string;
    name: string;
    avatar: {
      url: string;
      thumb_url: string;
    };
  };
}

// --- WCA OAuth Functions ---

/**
 * Exchange an authorization code for WCA OAuth tokens.
 */
export async function exchangeWCACode(
  accessCode: string,
): Promise<WCAOauthResponse> {
  const { WCA_URL, APPLICATION_ID, APPLICATION_SECRET, REDIRECT_URI } =
    getWCAConfig();

  const response = await fetch(`${WCA_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: accessCode,
      client_id: APPLICATION_ID,
      client_secret: APPLICATION_SECRET,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(
      `[WCA OAuth] Token exchange failed: ${response.status}`,
      text,
    );
    throw new Error(`WCA token exchange failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Refresh an expired WCA access token.
 */
export async function refreshWCAToken(
  refreshToken: string,
): Promise<WCAOauthResponse> {
  const { WCA_URL, APPLICATION_ID, APPLICATION_SECRET } = getWCAConfig();

  const response = await fetch(`${WCA_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: APPLICATION_ID,
      client_secret: APPLICATION_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh WCA token: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch the authenticated user's info from the WCA API.
 */
export async function fetchWCAUser(
  accessToken: string,
): Promise<WCAUserResponseInfo> {
  const { WCA_URL } = getWCAConfig();

  const response = await fetch(`${WCA_URL}/api/v0/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch WCA user info: ${response.status}`);
  }

  return response.json();
}

/**
 * Get (and auto-refresh if expired) the WCA access token for a session.
 */
export async function getWCAToken(
  sessionToken: string,
): Promise<string | null> {
  const session = getSessionByToken(sessionToken);
  if (!session) return null;

  const now = Date.now();

  if (now >= session.wcaTokenExpiresAt.getTime()) {
    // Token expired — refresh it
    try {
      const newTokens = await refreshWCAToken(session.wcaRefreshToken);
      const newExpiry = new Date(
        newTokens.created_at * 1000 + newTokens.expires_in * 1000,
      );

      updateWCATokens(session.id, {
        wcaToken: newTokens.access_token,
        wcaRefreshToken: newTokens.refresh_token,
        wcaTokenExpiresAt: newExpiry,
      });

      return newTokens.access_token;
    } catch (err) {
      console.error("[Auth] Failed to refresh WCA token:", err);
      // Delete the session if refresh fails (user needs to re-auth)
      removeSession(sessionToken);
      return null;
    }
  }

  return session.wcaToken;
}

// --- Session Management ---

/**
 * Create a new session after OAuth verification.
 * Stores WCA tokens alongside the session token.
 */
export async function createSession(
  userId: number,
  wcaToken: string,
  wcaRefreshToken: string,
  wcaTokenExpiresAt: Date,
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  insertSession({
    token,
    userId,
    wcaToken,
    wcaRefreshToken,
    wcaTokenExpiresAt,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Validate a session token. Returns the user if valid, null otherwise.
 */
export async function validateSession(token: string): Promise<User | null> {
  if (!token) return null;

  // SQLite has no TTL index, so purge expired sessions opportunistically.
  deleteExpiredSessions();

  const result = findSessionWithUser(token);
  return result?.user ?? null;
}

/**
 * Delete a session (logout).
 */
export async function deleteSession(token: string): Promise<void> {
  removeSession(token);
}

/**
 * Delete all sessions for a user.
 */
export async function deleteAllUserSessions(userId: number): Promise<void> {
  removeAllUserSessions(userId);
}

/**
 * Extract session token from a request's cookies.
 */
export function getTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)session_token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Full auth flow: extract token from request → validate → return user or null.
 */
export async function authenticateRequest(
  request: Request,
): Promise<User | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return validateSession(token);
}

/**
 * Find or create a user from WCA OAuth data.
 */
export async function findOrCreateUser(wcaData: {
  wcaUserID: number;
  wcaID: string;
  name: string;
}): Promise<User> {
  return upsertUser(wcaData);
}

/**
 * Returns the WCA OAuth authorize URL for the login button redirect.
 */
export function getWCAAuthorizeURL(): string {
  const { WCA_URL, APPLICATION_ID, REDIRECT_URI } = getWCAConfig();
  const url = new URL(`${WCA_URL}/oauth/authorize`);
  url.searchParams.set("client_id", APPLICATION_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "public");
  return url.toString();
}
