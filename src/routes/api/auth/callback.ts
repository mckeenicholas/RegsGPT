import type { APIEvent } from "@solidjs/start/server";
import {
  exchangeWCACode,
  fetchWCAUser,
  findOrCreateUser,
  createSession,
} from "~/lib/server/services/auth";

/**
 * GET /api/auth/callback?code=...
 *
 * WCA redirects here after the user authorizes.
 * Exchanges the code for tokens, creates the user/session, sets cookie, redirects to /.
 */
export async function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url);
    const accessCode = url.searchParams.get("code");

    if (!accessCode) {
      return new Response("Missing authorization code", { status: 400 });
    }

    const oAuthData = await exchangeWCACode(accessCode);

    const userInfo = await fetchWCAUser(oAuthData.access_token);
    const { name, id: wcaUserId, wca_id: wcaId } = userInfo.me;

    const user = await findOrCreateUser({
      wcaUserID: wcaUserId,
      wcaID: wcaId || "",
      name,
    });

    const wcaTokenExpiresAt = new Date(oAuthData.created_at * 1000 + oAuthData.expires_in * 1000);

    const { token, expiresAt } = await createSession(
      user.id,
      oAuthData.access_token,
      oAuthData.refresh_token,
      wcaTokenExpiresAt,
    );

    const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
      },
    });
  } catch (error) {
    console.error("[Auth Callback] Error:", error);
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=1" },
    });
  }
}
