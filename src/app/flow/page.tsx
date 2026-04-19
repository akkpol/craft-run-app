import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, JetBrains_Mono } from "next/font/google";
import { getAllowedActions, getWorkflowPolicy } from "@/lib/workflow-policy";

const plexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-flow-sans",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-flow-mono",
});

export const metadata: Metadata = {
  title: "FOGUS คู่มือการทำงาน",
  description: "คู่มือสถานะงานและขั้นตอนการทำงานของ FOGUS แบบภาษาไทย",
};

const canonicalPolicyDoc = "docs/workflow-policy.json";
const derivativeTableDoc = "docs/WORKFLOW_TRANSITION_TABLE.md";

type WorkflowPolicyData = {
  meta: {
    canonicalSources: string[];
    mainPath: string[];
    branches: string[];
    notes: string[];
  };
  conversation: {
    states: string[];
    terminalStates: string[];
    transitions: Record<string, string[]>;
  };
  quote_payment: {
    paymentTerms: string[];
    unlockRules: Record<string, string[]>;
    approvalDecisions: {
      unlockedNextState: string;
      lockedNextState: string;
    };
  };
  policies: {
    guardRails: string[];
  };
};

const stateThaiLabel: Record<string, string> = {
  NEW_MESSAGE: "เริ่มคุยงานใหม่",
  COLLECTING_REQUIREMENTS: "เก็บรายละเอียดงาน",
  REQUIREMENTS_REVIEW: "ตรวจความครบถ้วนของข้อมูล",
  WAITING_QUOTE_APPROVAL: "รออนุมัติใบเสนอราคา",
  WAITING_PAYMENT: "รอชำระเงิน",
  IN_DESIGN: "กำลังออกแบบ",
  IN_PRODUCTION: "กำลังผลิต",
  READY_FOR_FULFILLMENT: "พร้อมส่งมอบ",
  COMPLETED: "ส่งมอบสำเร็จ",
  ON_HOLD_CUSTOMER_INPUT: "พักงาน รอลูกค้าตอบ",
  HUMAN_REVIEW_REQUIRED: "รอแอดมินดูเคส",
  CANCELLED: "ยกเลิกงาน",
};

const paymentThaiLabel: Record<string, string> = {
  credit: "เครดิต",
  deposit: "มัดจำ",
  prepaid: "ชำระเต็มจำนวน",
};

function toThaiStateLabel(state: string) {
  return stateThaiLabel[state] ?? state;
}

function toThaiPaymentLabel(term: string) {
  return paymentThaiLabel[term] ?? term;
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

function StatePill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "branch" | "terminal";
}) {
  const classes =
    tone === "terminal"
      ? "bg-primary text-primary-foreground"
      : tone === "branch"
        ? "bg-amber-100 text-amber-900"
        : "bg-secondary text-secondary-foreground";

  return (
    <span
      className={`inline-flex rounded-xl px-3 py-2 text-xs font-semibold tracking-[0.08em] [font-family:var(--font-flow-mono)] ${classes}`}
    >
      {label}
    </span>
  );
}

export default function FlowPage() {
  const policy = getWorkflowPolicy() as WorkflowPolicyData;
  const flowPageActions = getAllowedActions({
    actor: "dev_ai",
    surface: "flow_page",
  });

  const mainPath = policy.meta.mainPath.map((segment) => segment.split("|"));
  const sideBranches = policy.meta.branches.map((state) => ({
    state,
    nextStates: policy.conversation.transitions[state] ?? [],
  }));
  const transitionRows = policy.conversation.states.map((state) => ({
    state,
    nextStates: policy.conversation.transitions[state] ?? [],
  }));
  const paymentRules = policy.quote_payment.paymentTerms.map((term) => ({
    term,
    unlockStatuses: policy.quote_payment.unlockRules[term] ?? [],
  }));

  return (
    <main
      className={`${plexSansThai.variable} ${jetBrainsMono.variable} flow-theme-shell [font-family:var(--font-flow-sans)] text-foreground`}
    >
      <section className="flow-theme-hero px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
            คู่มือ Workflow FOGUS
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            คู่มือขั้นตอนงานฉบับภาษาไทย
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/85 sm:text-base">
            หน้านี้ช่วยให้ลูกค้าและทีมงานเข้าใจว่า งานอยู่ขั้นตอนไหน ต้องทำอะไรต่อ และจะเดินไปสถานะไหนได้บ้าง
            โดยแสดงข้อมูลจาก policy จริงของระบบแบบอ่านง่าย
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="flow-theme-note px-4 py-4 text-sm leading-7 text-amber-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                หมายเหตุการใช้งาน
              </p>
              <p className="mt-2 rounded-xl bg-white/80 px-3 py-3 font-semibold">
                หน้านี้เป็น &quot;คู่มืออธิบาย&quot; ไม่ได้ใช้แก้สถานะงานโดยตรง
              </p>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 text-sm leading-7 text-white/90">
              <p className="font-semibold">มุมมองปัจจุบันของหน้า Flow</p>
              <p className="mt-2">{flowPageActions.ui_intent}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {flowPageActions.allowed_actions.map((action) => (
                  <span
                    key={action}
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs [font-family:var(--font-flow-mono)]"
                  >
                    {action}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav className="flow-theme-nav sticky top-0 z-20 px-4">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto py-3 text-sm text-muted-foreground">
          {[
            ["#quick-guide", "เริ่มต้นใช้งาน"],
            ["#main-path", "เส้นทางหลัก"],
            ["#branches", "ทางแยก/ข้อยกเว้น"],
            ["#payment-gate", "กติกาการชำระเงิน"],
            ["#states", "สถานะทั้งหมด"],
            ["#policy-source", "แหล่งข้อมูลอ้างอิง"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="shrink-0 rounded-full px-4 py-2 transition hover:bg-card hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-10 sm:px-6">
        <section id="quick-guide" className="flow-theme-card scroll-mt-24 p-6">
          <SectionTitle
            eyebrow="Quick guide"
            title="หน้านี้ใช้ทำอะไร"
            description="ถ้าลูกค้าหรือทีมงานเปิดมาหน้าเดียว ควรเห็นทันทีว่าเคสเดินถึงไหนและต้องทำอะไรต่อ"
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="flow-theme-soft p-4">
              <p className="text-sm font-semibold">1) ดูสถานะปัจจุบัน</p>
              <p className="mt-2 text-sm text-muted-foreground">
                เริ่มที่ส่วน &quot;เส้นทางหลัก&quot; เพื่อเทียบว่างานอยู่ขั้นไหนในภาพรวม
              </p>
            </div>
            <div className="flow-theme-soft p-4">
              <p className="text-sm font-semibold">2) ดูว่าลูกค้าต้องทำอะไร</p>
              <p className="mt-2 text-sm text-muted-foreground">
                ตรวจส่วน &quot;กติกาการชำระเงิน&quot; และ &quot;ทางแยก/ข้อยกเว้น&quot; ว่าต้องรออะไรหรือมี action อะไรบ้าง
              </p>
            </div>
            <div className="flow-theme-soft p-4">
              <p className="text-sm font-semibold">3) ตรวจความถูกต้องกับ policy</p>
              <p className="mt-2 text-sm text-muted-foreground">
                หากข้อมูลดูแปลก ให้ดูแหล่งอ้างอิงท้ายหน้า เพื่อเทียบกับไฟล์ policy จริง
              </p>
            </div>
          </div>
        </section>

        <section id="main-path" className="flow-theme-card scroll-mt-24 p-6">
          <SectionTitle
            eyebrow="Main path"
            title="เส้นทางหลักของงาน"
            description="ลำดับนี้คือเส้นทางปกติที่งานส่วนใหญ่จะวิ่งผ่านตั้งแต่เริ่มคุยจนส่งมอบ"
          />

          <div className="flex flex-wrap items-center gap-2">
            {mainPath.map((options, index) => (
              <div key={`${options.join("-")}-${index}`} className="contents">
                {options.length === 1 ? (
                  <StatePill
                    label={`${options[0]} · ${toThaiStateLabel(options[0])}`}
                    tone={policy.conversation.terminalStates.includes(options[0]) ? "terminal" : "default"}
                  />
                ) : (
                  <div className="flow-theme-soft flex flex-wrap items-center gap-2 px-3 py-2">
                    {options.map((option, optionIndex) => (
                      <div key={option} className="flex items-center gap-2">
                        <StatePill label={`${option} · ${toThaiStateLabel(option)}`} />
                        {optionIndex < options.length - 1 ? (
                          <span className="text-xs font-semibold text-muted-foreground">หรือ</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
                {index < mainPath.length - 1 ? <span className="px-1 text-muted-foreground">→</span> : null}
              </div>
            ))}
          </div>
        </section>

        <section id="branches" className="flow-theme-card scroll-mt-24 p-6">
          <SectionTitle
            eyebrow="Branches"
            title="ทางแยก/ข้อยกเว้น"
            description="สถานะกลุ่มนี้คือเคสที่ต้องคุยเพิ่ม รอลูกค้า หรือหยุดงานชั่วคราว ไม่ใช่เส้นทางปกติ"
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sideBranches.map(({ state, nextStates }) => {
              const isTerminal = nextStates.length === 0;

              return (
                <div key={state} className="flow-theme-soft p-4">
                  <div className="flex items-center justify-between gap-3">
                    <StatePill
                      label={`${state} · ${toThaiStateLabel(state)}`}
                      tone={isTerminal ? "terminal" : "branch"}
                    />
                    {isTerminal ? (
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground">
                        จบสถานะ
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                        ทางแยก
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      ไปต่อได้เป็น
                    </p>
                    {isTerminal ? (
                      <p className="mt-2 text-sm text-muted-foreground">สถานะนี้จบแล้ว ไม่สามารถเดินต่อได้</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {nextStates.map((nextState) => (
                          <StatePill
                            key={`${state}-${nextState}`}
                            label={`${nextState} · ${toThaiStateLabel(nextState)}`}
                            tone={policy.conversation.terminalStates.includes(nextState) ? "terminal" : "default"}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="payment-gate" className="flow-theme-card scroll-mt-24 p-6">
          <SectionTitle
            eyebrow="Payment gate"
            title="กติกาการชำระเงินก่อนปลดล็อกงาน"
            description="แม้ลูกค้าอนุมัติใบเสนอราคาแล้ว ระบบจะเช็กเงื่อนไขชำระเงินก่อนเข้าผลิตเสมอ"
          />

          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-secondary text-left text-secondary-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">รูปแบบการชำระเงิน</th>
                  <th className="px-4 py-3 font-semibold">สถานะชำระเงินที่ปลดล็อกได้</th>
                  <th className="px-4 py-3 font-semibold">ผลหลังอนุมัติ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card text-card-foreground">
                {paymentRules.map(({ term, unlockStatuses }) => (
                  <tr key={term}>
                    <td className="px-4 py-3 align-top font-semibold [font-family:var(--font-flow-mono)]">
                      {term} · {toThaiPaymentLabel(term)}
                    </td>
                    <td className="px-4 py-3 align-top [font-family:var(--font-flow-mono)]">
                      {JSON.stringify(unlockStatuses)}
                    </td>
                    <td className="px-4 py-3 align-top [font-family:var(--font-flow-mono)]">
                      <div>ปลดล็อก: {policy.quote_payment.approvalDecisions.unlockedNextState}</div>
                      <div className="mt-1">ยังไม่ปลดล็อก: {policy.quote_payment.approvalDecisions.lockedNextState}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="states" className="flow-theme-card scroll-mt-24 p-6">
          <SectionTitle
            eyebrow="All states"
            title="รายการสถานะทั้งหมดในระบบ"
            description="ตารางนี้ใช้ตรวจว่าแต่ละสถานะเดินต่อไปสถานะไหนได้บ้างตาม policy ปัจจุบัน"
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {transitionRows.map(({ state, nextStates }) => {
              const isTerminal = nextStates.length === 0;

              return (
                <div key={state} className="flow-theme-soft p-4">
                  <div className="flex items-center justify-between gap-3">
                    <StatePill
                      label={`${state} · ${toThaiStateLabel(state)}`}
                      tone={isTerminal ? "terminal" : "default"}
                    />
                    {isTerminal ? (
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground">
                        จบสถานะ
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      ไปต่อได้เป็น
                    </p>
                    {isTerminal ? (
                      <p className="mt-2 text-sm text-muted-foreground">ไม่มีสถานะถัดไป</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {nextStates.map((nextState) => (
                          <StatePill
                            key={`${state}-${nextState}`}
                            label={`${nextState} · ${toThaiStateLabel(nextState)}`}
                            tone={policy.conversation.terminalStates.includes(nextState) ? "terminal" : "default"}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="policy-source" className="flow-theme-card scroll-mt-24 p-6">
          <SectionTitle
            eyebrow="Source of truth"
            title="แหล่งข้อมูลอ้างอิงของหน้านี้"
            description="ถ้าจะเปลี่ยน behavior จริงของระบบ ต้องแก้ที่ policy และ runtime helper ไม่ใช่แก้เฉพาะหน้าแสดงผล"
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flow-theme-soft p-4">
              <p className="text-sm font-semibold">Canonical policy (เครื่องอ่าน)</p>
              <p className="mt-2 text-sm text-muted-foreground">แหล่งจริงที่ระบบอ้างอิงโดยตรง</p>
              <div className="mt-3 rounded-xl bg-card px-3 py-3 text-sm [font-family:var(--font-flow-mono)]">
                {canonicalPolicyDoc}
              </div>
            </div>

            <div className="flow-theme-soft p-4">
              <p className="text-sm font-semibold">เอกสารสรุป (คนอ่าน)</p>
              <p className="mt-2 text-sm text-muted-foreground">ใช้ดูภาพรวม แต่ไม่ใช่ source of truth</p>
              <div className="mt-3 rounded-xl bg-card px-3 py-3 text-sm [font-family:var(--font-flow-mono)]">
                {derivativeTableDoc}
              </div>
            </div>
          </div>

          <div className="flow-theme-note mt-4 p-4 text-sm leading-6 text-amber-950">
            <p className="font-semibold">ข้อกำหนดสำคัญจาก policy</p>
            <ul className="mt-2 space-y-1">
              {policy.policies.guardRails.map((rule) => (
                <li key={rule}>- {rule}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <footer className="border-t border-border px-6 py-10 text-center text-sm leading-7 text-muted-foreground">
        <p>FOGUS ERP 2026 · คู่มือภาษาไทยสำหรับลูกค้าและทีมปฏิบัติการ</p>
        <p>หน้าคู่มือนี้อ่านจาก policy ปัจจุบัน และเป็นหน้าแสดงผลแบบ read-only</p>
      </footer>
    </main>
  );
}
