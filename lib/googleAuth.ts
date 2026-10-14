import { createSign } from "node:crypto";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
].join(" ");

let cached: { token: string; expiresAt: number } | null = null;

function loadCredentials(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Falta la variable de entorno GOOGLE_SERVICE_ACCOUNT_JSON.");
  const j = JSON.parse(raw) as { client_email?: string; private_key?: string };
  if (!j.client_email || !j.private_key) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no tiene client_email / private_key.");
  return { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, "\n") };
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** Token de acceso de la cuenta de servicio (JWT bearer), cacheado hasta cerca de su vencimiento. */
export async function getGoogleToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - 60 > now) return cached.token;
  const { client_email, private_key } = loadCredentials();
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: client_email,
      scope: SCOPES,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claim}`).sign(private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${claim}.${signature}`,
    cache: "no-store",
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!json.access_token) throw new Error(`Google rechazó la cuenta de servicio: ${json.error_description ?? res.status}`);
  cached = { token: json.access_token, expiresAt: now + (json.expires_in ?? 3600) };
  return cached.token;
}
