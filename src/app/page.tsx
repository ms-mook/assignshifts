import { redirect } from "next/navigation";
import { ymString } from "@/lib/config";
import { tableById } from "@/lib/tables";

export default function Home({ searchParams }: { searchParams: { t?: string } }) {
  // เดือนปัจจุบันตามเวลาประเทศไทย
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const t = tableById(searchParams.t ?? "")?.id ?? "s1";
  redirect(`/schedule/${t}/${ymString(now.getUTCFullYear() + 543, now.getUTCMonth() + 1)}`);
}
