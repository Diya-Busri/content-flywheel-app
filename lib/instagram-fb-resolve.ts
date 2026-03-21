/**
 * Resolve Instagram Business Account ID + Page Access Token for Graph API publishing.
 * Do not use the Instagram Login "user" id from /me on graph.instagram.com for /{id}/media on graph.facebook.com.
 *
 * @see https://developers.facebook.com/docs/instagram-api/getting-started
 */

const FB_GRAPH = "https://graph.facebook.com/v21.0";

export type ResolvedIgPublishContext = {
  pageAccessToken: string;
  igBusinessAccountId: string;
  pageId?: string;
};

function logStep(label: string, payload: unknown) {
  try {
    console.log(`[instagram-fb-resolve] ${label}:`, JSON.stringify(payload, null, 2));
  } catch {
    console.log(`[instagram-fb-resolve] ${label}:`, payload);
  }
}

/**
 * 1) GET /me/accounts — Facebook user token: yields per-page access_token + instagram_business_account.id
 * 2) GET /me — Page token: "me" is the Page; yields instagram_business_account when linked
 */
export async function resolveInstagramPublishContext(params: {
  accessToken: string;
  /** Prefer this IG business account id when multiple pages exist (from connected_accounts.platform_user_id). */
  preferredIgBusinessAccountId?: string | null;
}): Promise<{ ok: true; context: ResolvedIgPublishContext } | { ok: false; error: string; details?: unknown }> {
  const { accessToken, preferredIgBusinessAccountId } = params;
  if (!accessToken?.trim()) {
    return { ok: false, error: "Missing access token" };
  }

  const accountsUrl = `${FB_GRAPH}/me/accounts?fields=name,id,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`;
  logStep("request GET /me/accounts", { url: accountsUrl.replace(accessToken, "[REDACTED]") });

  let accJson: {
    data?: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string; username?: string };
    }>;
    error?: { message?: string; type?: string; code?: number };
  };
  try {
    const accRes = await fetch(accountsUrl);
    const text = await accRes.text();
    logStep("response GET /me/accounts (raw status)", { status: accRes.status, statusText: accRes.statusText });
    try {
      accJson = text ? (JSON.parse(text) as typeof accJson) : {};
    } catch {
      accJson = {};
      logStep("response GET /me/accounts (parse error)", { text: text.slice(0, 2000) });
    }
    logStep("response GET /me/accounts (body)", accJson);
  } catch (e) {
    logStep("response GET /me/accounts (network error)", { message: e instanceof Error ? e.message : String(e) });
    accJson = {};
  }

  const data = Array.isArray(accJson.data) ? accJson.data : [];

  const pickPage = () => {
    if (preferredIgBusinessAccountId) {
      const pref = preferredIgBusinessAccountId.trim();
      const found = data.find(
        (p) => p.instagram_business_account?.id && p.instagram_business_account.id === pref
      );
      if (found?.access_token && found.instagram_business_account?.id) return found;
    }
    return data.find((p) => p.instagram_business_account?.id && p.access_token);
  };

  if (data.length > 0) {
    const page = pickPage();
    if (page?.access_token && page.instagram_business_account?.id) {
      return {
        ok: true,
        context: {
          pageAccessToken: page.access_token,
          igBusinessAccountId: page.instagram_business_account.id,
          pageId: page.id,
        },
      };
    }
    if (accJson.error?.message) {
      logStep("note", { message: "/me/accounts returned data issues or no linked IG", graphError: accJson.error });
    }
  }

  // Fallback: token may already be a Page access token
  const meUrl = `${FB_GRAPH}/me?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`;
  logStep("request GET /me (page-token fallback)", { url: meUrl.replace(accessToken, "[REDACTED]") });

  let meJson: {
    id?: string;
    name?: string;
    instagram_business_account?: { id?: string; username?: string };
    error?: { message?: string; type?: string; code?: number };
  };
  try {
    const meRes = await fetch(meUrl);
    const text = await meRes.text();
    logStep("response GET /me (raw status)", { status: meRes.status, statusText: meRes.statusText });
    try {
      meJson = text ? (JSON.parse(text) as typeof meJson) : {};
    } catch {
      meJson = {};
      logStep("response GET /me (parse error)", { text: text.slice(0, 2000) });
    }
    logStep("response GET /me (body)", meJson);
  } catch (e) {
    logStep("response GET /me (network error)", { message: e instanceof Error ? e.message : String(e) });
    meJson = {};
  }

  const igId = meJson.instagram_business_account?.id;
  if (igId) {
    if (preferredIgBusinessAccountId?.trim() && preferredIgBusinessAccountId.trim() !== igId) {
      console.warn("[instagram-fb-resolve] preferred platform_user_id differs from Page /me; using API ig id", {
        preferred: preferredIgBusinessAccountId,
        resolved: igId,
      });
    }
    return {
      ok: true,
      context: {
        pageAccessToken: accessToken,
        igBusinessAccountId: igId,
        pageId: meJson.id,
      },
    };
  }

  const hint =
    accJson.error?.message ||
    meJson.error?.message ||
    "No Instagram Business account found. Connect Facebook with Page access (pages_show_list) or use a Page access token for a Page linked to Instagram.";
  return {
    ok: false,
    error: hint,
    details: { accountsError: accJson.error, meError: meJson.error, accountsData: accJson.data, me: meJson },
  };
}
