import { redirect } from "next/navigation";
import { ymString } from "@/lib/config";

export default function Home() {
  // เดือนปัจจุบันตามเวลาประเทศไทย
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  redirect(`/schedule/${ymString(now.getUTCFullYear() + 543, now.getUTCMonth() + 1)}`);
}
