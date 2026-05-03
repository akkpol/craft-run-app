import { cn } from "@/lib/utils";

export type PublicFlowStageItem = {
  key: string;
  label: string;
  description: string;
};

export default function PublicFlowStageStrip({
  eyebrow = "Flow checkpoint",
  title,
  description,
  items,
  activeKey,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  items: PublicFlowStageItem[];
  activeKey: string;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">{eyebrow}</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>

      <div className="mt-4 grid gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item, index) => {
          const active = item.key === activeKey;

          return (
            <div
              key={item.key}
              className={cn(
                "rounded-[20px] border px-4 py-4 transition-colors",
                active
                  ? "border-sky-200 bg-white shadow-[0_8px_24px_rgba(14,165,233,0.12)]"
                  : "border-slate-200 bg-white/80"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    active ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {index + 1}
                </div>
                <p className={cn("text-sm font-semibold", active ? "text-slate-950" : "text-slate-700")}>{item.label}</p>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}