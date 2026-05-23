import { storage } from "./storage";

const SF_AUTHORIZE_URL = "https://login.salesforce.com/services/oauth2/authorize";
const SF_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set`);
  return v;
}

export function buildSalesforceAuthUrl(opts: {
  redirectUri: string;
  state: string;
}): string {
  const clientId = requireEnv("SALESFORCE_CLIENT_ID");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    scope: "api refresh_token",
  });

  return `${SF_AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(args: {
  code: string;
  redirectUri: string;
}): Promise<{
  access_token: string;
  refresh_token: string;
  instance_url: string;
  issued_at: string;
}> {
  const clientId = requireEnv("SALESFORCE_CLIENT_ID");
  const clientSecret = requireEnv("SALESFORCE_CLIENT_SECRET");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: args.redirectUri,
    code: args.code,
  });

  const res = await fetch(SF_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce token exchange failed: ${text}`);
  }

  return (await res.json()) as any;
}

async function refreshAccessToken(args: {
  refreshToken: string;
}): Promise<{
  access_token: string;
  instance_url: string;
  issued_at: string;
}> {
  const clientId = requireEnv("SALESFORCE_CLIENT_ID");
  const clientSecret = requireEnv("SALESFORCE_CLIENT_SECRET");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: args.refreshToken,
  });

  const res = await fetch(SF_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce token refresh failed: ${text}`);
  }

  return (await res.json()) as any;
}

export async function connectSalesforceForUser(args: {
  userId: number;
  code: string;
  redirectUri: string;
}): Promise<void> {
  const tokens = await exchangeCodeForTokens({
    code: args.code,
    redirectUri: args.redirectUri,
  });

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  await storage.upsertSalesforceTokens({
    userId: args.userId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    instanceUrl: tokens.instance_url,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
}

export async function disconnectSalesforceForUser(userId: number): Promise<void> {
  await storage.deleteSalesforceTokens(userId);
}

export async function getSalesforceStatus(userId: number): Promise<{ connected: boolean; instanceUrl?: string | null }> {
  const tokens = await storage.getSalesforceTokens(userId);
  if (!tokens) return { connected: false };
  return { connected: true, instanceUrl: tokens.instanceUrl };
}

async function getValidAccessToken(userId: number): Promise<{ accessToken: string; instanceUrl: string }> {
  const tokens = await storage.getSalesforceTokens(userId);
  if (!tokens) throw new Error("Salesforce not connected");

  const refreshWindowMs = 5 * 60 * 1000;
  if (tokens.expiresAt && tokens.expiresAt.getTime() - Date.now() > refreshWindowMs) {
    return { accessToken: tokens.accessToken, instanceUrl: tokens.instanceUrl };
  }

  const refreshed = await refreshAccessToken({ refreshToken: tokens.refreshToken });
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  await storage.upsertSalesforceTokens({
    userId,
    accessToken: refreshed.access_token,
    refreshToken: tokens.refreshToken,
    instanceUrl: refreshed.instance_url || tokens.instanceUrl,
    expiresAt,
    createdAt: tokens.createdAt,
    updatedAt: new Date(),
  } as any);

  return { accessToken: refreshed.access_token, instanceUrl: refreshed.instance_url || tokens.instanceUrl };
}

function splitName(fullName: string | null | undefined): { FirstName: string | null; LastName: string } {
  if (!fullName) return { FirstName: null, LastName: "Unknown" };
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { FirstName: null, LastName: "Unknown" };
  if (parts.length === 1) return { FirstName: null, LastName: parts[0] };
  return { FirstName: parts[0], LastName: parts.slice(1).join(" ") };
}

async function sfApiRequest(
  instanceUrl: string,
  accessToken: string,
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const url = `${instanceUrl}/services/data/v59.0${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce API error (${res.status}): ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (res.status === 204 || !contentType.includes("application/json")) {
    return { success: true };
  }

  return res.json();
}

export async function syncContactToSalesforce(userId: number, contact: {
  email?: string | null;
  name?: string | null;
  company?: string | null;
  title?: string | null;
  phone?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
}): Promise<{ success: boolean; message: string; salesforceId?: string; action?: string }> {
  if (!contact.email) {
    return { success: false, message: "Contact must have an email to sync to Salesforce" };
  }

  const { accessToken, instanceUrl } = await getValidAccessToken(userId);
  const { FirstName, LastName } = splitName(contact.name);

  let existingId: string | null = null;
  try {
    const query = encodeURIComponent(`SELECT Id FROM Contact WHERE Email = '${contact.email.replace(/'/g, "\\'")}'`);
    const searchRes = await sfApiRequest(instanceUrl, accessToken, "GET", `/query?q=${query}`);
    if (searchRes.records && searchRes.records.length > 0) {
      existingId = searchRes.records[0].Id;
    }
  } catch {
    existingId = null;
  }

  const fields: Record<string, any> = {
    Email: contact.email,
    LastName,
    Title: contact.title || undefined,
    Phone: contact.phone || undefined,
  };
  if (FirstName) fields.FirstName = FirstName;

  Object.keys(fields).forEach((k) => fields[k] === undefined && delete fields[k]);

  try {
    if (existingId) {
      await sfApiRequest(instanceUrl, accessToken, "PATCH", `/sobjects/Contact/${existingId}`, fields);
      return { success: true, message: "Updated in Salesforce", salesforceId: existingId, action: "updated" };
    } else {
      const created = await sfApiRequest(instanceUrl, accessToken, "POST", "/sobjects/Contact", fields);
      return { success: true, message: "Created in Salesforce", salesforceId: created.id, action: "created" };
    }
  } catch (e: any) {
    return { success: false, message: e?.message || "Salesforce sync failed" };
  }
}

export async function createSalesforceNote(userId: number, opts: {
  title: string;
  body: string;
  contactEmail?: string;
}): Promise<{ success: boolean; message: string }> {
  const { accessToken, instanceUrl } = await getValidAccessToken(userId);

  let contactId: string | null = null;
  if (opts.contactEmail) {
    try {
      const query = encodeURIComponent(`SELECT Id FROM Contact WHERE Email = '${opts.contactEmail.replace(/'/g, "\\'")}'`);
      const searchRes = await sfApiRequest(instanceUrl, accessToken, "GET", `/query?q=${query}`);
      if (searchRes.records && searchRes.records.length > 0) {
        contactId = searchRes.records[0].Id;
      }
    } catch {}
  }

  try {
    const noteFields: Record<string, any> = {
      Title: opts.title,
      Body: opts.body,
    };
    if (contactId) {
      noteFields.ParentId = contactId;
    }

    await sfApiRequest(instanceUrl, accessToken, "POST", "/sobjects/Note", noteFields);
    return { success: true, message: contactId ? "Note created and linked to contact" : "Note created (no matching contact found)" };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to create note" };
  }
}
