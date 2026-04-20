"use client";

import { useState } from "react";
import { type ProductionUploadFormCopy } from "@/lib/production-copy";
import { type ProductionEventType } from "@/lib/production-review";

type ProductionEventOption = {
  value: ProductionEventType;
  label: string;
};

export default function ProductionUploadForm({
  token,
  copy,
  eventOptions,
}: {
  token: string;
  copy: ProductionUploadFormCopy;
  eventOptions: readonly ProductionEventOption[];
}) {
  const [eventType, setEventType] =
    useState<ProductionEventType>(eventOptions[0]?.value ?? "proof");
  const [submittedByLabel, setSubmittedByLabel] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const formData = new FormData();
    formData.append("eventType", eventType);
    formData.append("submittedByLabel", submittedByLabel);
    formData.append("note", note);

    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch(`/api/production/${token}/events`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || copy.uploadFailed);
        return;
      }

      setMessage(copy.successMessage);
      setNote("");
      setFiles([]);
      const form = event.currentTarget;
      form.reset();
    } catch {
      setError(copy.uploadFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="grid gap-2 text-sm text-slate-700">
        <span>{copy.eventTypeLabel}</span>
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value as ProductionEventType)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
        >
          {eventOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm text-slate-700">
        <span>{copy.submittedByLabel}</span>
        <input
          value={submittedByLabel}
          onChange={(e) => setSubmittedByLabel(e.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
          placeholder={copy.submittedByPlaceholder}
        />
      </label>

      <label className="grid gap-2 text-sm text-slate-700">
        <span>{copy.noteLabel}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
          placeholder={copy.notePlaceholder}
        />
      </label>

      <label className="grid gap-2 text-sm text-slate-700">
        <span>{copy.filesLabel}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="block text-sm"
        />
        <p className="text-xs text-slate-500">{copy.filesHint}</p>
      </label>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading || files.length === 0}
        className="w-full rounded-full bg-[#0f172a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#111c35] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? copy.submitLoadingLabel : copy.submitIdleLabel}
      </button>
    </form>
  );
}
