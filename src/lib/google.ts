// เชื่อม Google Sheets API ด้วย Service Account (ฝั่ง server เท่านั้น)
// รองรับ 2 แบบ:
//   1) ไม่ใช้ key (แนะนำ): Vercel OIDC + Workload Identity Federation
//      ต้องตั้ง GCP_PROJECT_NUMBER, GCP_WORKLOAD_IDENTITY_POOL_ID, GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
//      GOOGLE_SERVICE_ACCOUNT_EMAIL
//   2) key JSON: GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY
import "server-only";
import { headers } from "next/headers";
import { ExternalAccountClient, JWT } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

interface TokenClient {
  getAccessToken(): Promise<{ token?: string | null }>;
}

let client: TokenClient | null = null;

/** Vercel ส่ง OIDC token มากับ request ทุกครั้งใน header x-vercel-oidc-token (ตอนรันในเครื่องใช้ env VERCEL_OIDC_TOKEN) */
function vercelOidcToken(): string {
  let token: string | null | undefined;
  try {
    token = headers().get("x-vercel-oidc-token");
  } catch {
    token = undefined;
  }
  token = token || process.env.VERCEL_OIDC_TOKEN;
  if (!token) throw new Error("ไม่พบ Vercel OIDC token — ตรวจว่าเปิด OIDC Federation ในโปรเจกต์ Vercel แล้ว");
  return token;
}

function getClient(): TokenClient {
  if (client) return client;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!email) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (key) {
    client = new JWT({ email, key, scopes: SCOPES });
    return client;
  }
  const projectNumber = process.env.GCP_PROJECT_NUMBER;
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID;
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;
  if (!projectNumber || !poolId || !providerId) {
    throw new Error(
      "ยังไม่ได้ตั้งค่าการเชื่อม Google: ใส่ GCP_PROJECT_NUMBER, GCP_WORKLOAD_IDENTITY_POOL_ID, GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID (หรือ GOOGLE_PRIVATE_KEY)",
    );
  }
  const ext = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${email}:generateAccessToken`,
    subject_token_supplier: { getSubjectToken: async () => vercelOidcToken() },
  } as unknown as Parameters<typeof ExternalAccountClient.fromJSON>[0]);
  if (!ext) throw new Error("สร้างการเชื่อม Workload Identity ไม่สำเร็จ");
  ext.scopes = SCOPES;
  // token ที่ได้มีอายุสั้นและผูกกับ request — สร้างใหม่ทุกครั้งเพื่อความชัวร์
  return ext;
}

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

async function call<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = (await getClient().getAccessToken()).token;
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Sheets API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export type Values = unknown[][];

/** อ่านหลายช่วงพร้อมกัน — ค่าดิบ (ตัวเลข/วันที่เป็น serial) */
export async function batchGet(
  spreadsheetId: string,
  ranges: string[],
  render: "UNFORMATTED_VALUE" | "FORMATTED_VALUE" = "UNFORMATTED_VALUE",
): Promise<Values[]> {
  const q = new URLSearchParams({ valueRenderOption: render, dateTimeRenderOption: "SERIAL_NUMBER" });
  for (const r of ranges) q.append("ranges", r);
  const data = await call<{ valueRanges: { values?: Values }[] }>(`${BASE}/${spreadsheetId}/values:batchGet?${q}`);
  return data.valueRanges.map((v) => v.values ?? []);
}

/** เขียนหลายช่วง (USER_ENTERED = เหมือนพิมพ์ในชีต: วันที่ ISO และสูตร "=..." ใช้ได้) */
export async function batchUpdate(spreadsheetId: string, data: { range: string; values: Values }[]): Promise<void> {
  if (data.length === 0) return;
  await call(`${BASE}/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    body: { valueInputOption: "USER_ENTERED", data },
  });
}

export async function sheetTitles(spreadsheetId: string): Promise<string[]> {
  const d = await call<{ sheets: { properties: { title: string } }[] }>(
    `${BASE}/${spreadsheetId}?fields=sheets.properties.title`,
  );
  return d.sheets.map((s) => s.properties.title);
}

export async function addSheet(spreadsheetId: string, title: string, hidden = true): Promise<void> {
  await call(`${BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: { requests: [{ addSheet: { properties: { title, hidden } } }] },
  });
}
