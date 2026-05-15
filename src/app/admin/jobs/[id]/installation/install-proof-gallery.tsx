"use client";

import { useEffect, useState } from "react";

type SignedEntry = {
  path: string;
  url: string | null;
  isPdf: boolean;
};

export function InstallProofGallery({ paths }: { paths: string[] }) {
  const [entries, setEntries] = useState<SignedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchSigned() {
      if (paths.length === 0) {
        setEntries([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // Fan-out one fetch per path through the admin endpoint? Keep
        // it simple — fetch a fresh signed-URL list by re-calling the
        // GET endpoint. Reuse parent installation route below.
        const url = window.location.pathname.replace(/\/$/, "");
        const idMatch = url.match(/\/admin\/jobs\/([^/]+)\/installation/);
        const jobId = idMatch?.[1];
        if (!jobId) {
          throw new Error("Cannot infer job id from URL");
        }
        const res = await fetch(`/api/admin/jobs/${jobId}/installation`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "โหลดรูปไม่สำเร็จ");
        const urls: Array<string | null> = data.installation?.photoSignedUrls ?? [];
        if (!cancelled) {
          setEntries(
            paths.map((p, i) => ({
              path: p,
              url: urls[i] ?? null,
              isPdf: p.toLowerCase().endsWith(".pdf"),
            }))
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "โหลดรูปไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchSigned();
    return () => {
      cancelled = true;
    };
  }, [paths]);

  if (paths.length === 0) {
    return <p className="mt-2 text-xs text-slate-500">ยังไม่มีหลักฐาน</p>;
  }
  if (loading) {
    return <p className="mt-2 text-xs text-slate-500">กำลังโหลด...</p>;
  }
  if (error) {
    return <p className="mt-2 text-xs text-rose-700">{error}</p>;
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
      {entries.map((entry, idx) => (
        <a
          key={entry.path}
          href={entry.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          {entry.isPdf ? (
            <div className="flex aspect-square items-center justify-center bg-slate-100 text-xs text-slate-600">
              📄 PDF #{idx + 1}
            </div>
          ) : entry.url ? (
            <img
              src={entry.url}
              alt={`install proof ${idx + 1}`}
              className="aspect-square h-full w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center text-xs text-slate-500">
              ไม่สามารถโหลด
            </div>
          )}
        </a>
      ))}
    </div>
  );
}
