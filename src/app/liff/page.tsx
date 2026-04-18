import { redirect } from "next/navigation";

// LIFF endpoint URL is /liff — redirect to intake form
export default async function LiffPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
      continue;
    }

    if (typeof value === "string") {
      query.set(key, value);
    }
  }

  const target = query.size > 0 ? `/liff/intake?${query.toString()}` : "/liff/intake";
  redirect(target);
}
