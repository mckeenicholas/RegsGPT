import { action, query, redirect } from "@solidjs/router";
import { appendResponseHeader } from "@solidjs/start/http";
import type { APIEvent } from "@solidjs/start/server";
import { getRequestEvent } from "solid-js/web";
import {
  authenticateRequest,
  deleteSession,
  getTokenFromRequest,
} from "~/lib/server/services/auth";


export const getUserSession = query(async () => {
  "use server";
  const event = getRequestEvent();

  if (!event) {
    throw new Error("Unable to load session")
  }

  try {
    const user = await authenticateRequest(event.request);

    if (!user) {
      return null;
    }

    return {
      id: user._id.toString(),
      wcaUserID: user.wcaUserID,
      wcaID: user.wcaID,
      name: user.name,
      tokensUsed: user.tokensUsed,
      tokenCap: user.tokenCap,
    };
  } catch (error) {
    console.error("[Auth Session Query] Error:", error);
    throw error;
  }
}, "userSession");



export const logoutAction = action(async () => {
  "use server";
  const event = getRequestEvent();

  if (!event) {
    throw new Error("Unable to load session")
  }

  try {
    const token = getTokenFromRequest(event.request);

    if (token) {
      await deleteSession(token);
    }

    appendResponseHeader(
      "Set-Cookie",
      "session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
    );

  } catch (error) {
    console.error("[Auth Session logoutAction] Error:", error);
    if (error instanceof Error) throw error;
    throw new Error("Internal server error");
  }

  throw redirect("/");
}, "logout");

