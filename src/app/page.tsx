import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseYm, ymString } from "@/lib/config";
import { tableById } from "@/lib/tables";

export default function Home({ searchParams }: { searchParams: { t?: string } }) {
  const t = tableById(searchParams.t ?? "")?.id ?? "s1";
  // เดือนที่เปิดล่าสุด (เดือนที่กำลังทำ) ถ้าไม่มี ใช้เดือนปัจจุบันตามเวลาประเทศไทย
  const saved = cookies().get("shift-ym")?.value ?? "";
  if (parseYm(saved)) redirect(`/schedule/${t}/${saved}`);
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  redirect(`/schedule/${t}/${ymString(now.getUTCFullYear() + 543, now.getUTCMonth() + 1)}`);
}
