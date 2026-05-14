"use client";

import { FlaskConicalIcon, SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TEST_SCENARIOS, type TestScenario } from "@/lib/test-scenarios";

type ScenarioPickerProps = {
  /**
   * LIFF ID token from the form's liff.getIDToken() call. Used by the server
   * to verify the caller is in ADMIN_ALLOWED_EMAILS. May be empty when running
   * in non-LIFF mode (localhost dev) — in that case the gate falls back to the
   * server's NODE_ENV check.
   */
  liffIdToken: string;
  /**
   * Whether the parent has confirmed test mode is enabled via `?testMode=1`.
   * Component still performs its own server-side admin email check before
   * showing the chip in production.
   */
  testModeRequested: boolean;
  /** Called with the chosen scenario. Parent is responsible for applying values. */
  onScenarioSelected: (scenario: TestScenario) => void;
};

export default function ScenarioPicker({
  liffIdToken,
  testModeRequested,
  onScenarioSelected,
}: ScenarioPickerProps) {
  // null = not yet checked, true = allowed, false = denied. The effect only
  // runs when the parent has explicitly requested test mode via the URL flag,
  // so we never need to "reset" enabled — we just skip rendering instead.
  const [serverEnabled, setServerEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  useEffect(() => {
    if (!testModeRequested) return;

    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch("/api/test-mode/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ liffIdToken }),
        });

        if (!response.ok) {
          if (!cancelled) setServerEnabled(false);
          return;
        }

        const data = (await response.json()) as { enabled?: boolean };
        if (!cancelled) setServerEnabled(Boolean(data.enabled));
      } catch {
        if (!cancelled) setServerEnabled(false);
      }
    };

    void check();

    return () => {
      cancelled = true;
    };
  }, [testModeRequested, liffIdToken]);

  if (!testModeRequested || serverEnabled !== true) {
    return null;
  }

  const handleSelect = (scenario: TestScenario) => {
    setAppliedId(scenario.id);
    setOpen(false);
    onScenarioSelected(scenario);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-3 top-3 z-40 inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-50/95 px-3 py-1.5 text-xs font-medium text-amber-900 shadow-lg shadow-amber-500/20 backdrop-blur transition hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        aria-label="เปิด test scenario picker"
      >
        <FlaskConicalIcon className="size-3.5" aria-hidden />
        <span>Test Scenarios</span>
        {appliedId ? (
          <span className="rounded-full bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
            {appliedId.split("-")[0]}
          </span>
        ) : null}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-amber-500" aria-hidden />
              เลือก Test Scenario
            </SheetTitle>
            <SheetDescription>
              แตะเพื่อ autofill ฟอร์มทั้งหมดจาก preset. ปุ่มนี้ปรากฏเฉพาะ admin
              email หรือ non-prod environment — ลูกค้าจริงจะไม่เห็น.
            </SheetDescription>
          </SheetHeader>

          <ul className="space-y-2 px-4 pb-6">
            {TEST_SCENARIOS.map((scenario) => {
              const isApplied = appliedId === scenario.id;
              return (
                <li key={scenario.id}>
                  <Button
                    type="button"
                    variant={isApplied ? "default" : "outline"}
                    className="h-auto w-full justify-start gap-3 py-3 text-left"
                    onClick={() => handleSelect(scenario)}
                  >
                    <span className="flex flex-col items-start gap-0.5">
                      <span className="text-sm font-semibold">
                        {scenario.label}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {scenario.description}
                      </span>
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
