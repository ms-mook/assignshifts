// เชื่อม Google Sheets API ด้วย Service Account (ฝั่ง server เท่านั้น)
import "server-only";
import { JWT } from "google-auth-library";

let client: JWT | null = null;

function getClient(): JWT {
  if (client) return client;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY");
  client = new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return client;
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
