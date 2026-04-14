import { redirect } from "next/navigation";

// LIFF endpoint URL is /liff — redirect to intake form
export default function LiffPage() {
  redirect("/liff/intake");
}
