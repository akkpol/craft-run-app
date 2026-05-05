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

const runtimeSurfaces = [
  {
    title: "LINE OA / webhook",
    route: "LINE chat + /api/webhook",
    description:
      "จุดเริ่มของ conversation จริง ระบบจะตีความ intent แล้วส่งลูกค้าไป intake ใหม่, resume flow หรือหน้า quote/status ตามบริบทเดิม",
  },
  {
    title: "LIFF intake",
    route: "/liff/intake",
    description:
      "ฟอร์มรับ requirement บนมือถือที่ใส่ข้อมูลการออกเอกสาร, billing และไฟล์อ้างอิงได้ครบก่อนสร้าง lead/quote โดย production path นี้ควรเปิดผ่าน LINE/LIFF ส่วน devNoLiff ใช้สำหรับ local หรือ non-production เท่านั้น",
  },
  {
    title: "Customer portal lookup",
    route: "/status",
    description:
      "ทางเข้ากลางสำหรับลูกค้าที่มี tracking token อยู่แล้วและต้องการกลับเข้า quote หรือ status โดยตรง",
  },
  {
    title: "Quote + Status token pages",
    route: "/quote/[token] + /status/[token]",
    description:
      "หน้าจริงที่ลูกค้าใช้อนุมัติราคา, ดู commercial gate, ตอบกลับเรื่องแบบ และติดตามการผลิตต่อจนจบงาน",
  },
] as const;

const runtimeFlowStages = [
  {
    title: "1. Intake เข้าระบบ",
    state: "NEW_MESSAGE -> COLLECTING_REQUIREMENTS",
    detail:
      "ลูกค้าเริ่มจาก LINE หรือ LIFF แล้วระบบเก็บ requirement, profile และข้อมูลเอกสารให้พร้อมก่อนออก quote",
  },
  {
    title: "2. Quote Decision",
    state: "WAITING_QUOTE_APPROVAL",
    detail:
      "ลูกค้าตรวจราคา, approve/reject, และตัดสินใจว่าต้องแก้อะไรเพิ่มหรือพร้อมเดินต่อด้านการชำระเงิน",
  },
  {
    title: "3. Payment + Commercial Gate",
    state: "WAITING_PAYMENT / commercial review",
    detail:
      "ตรวจ payment status, receiver lock และเอกสารหลังรับชำระเพื่อยืนยันว่าเงินเข้าใครเอกสารต้องออกชื่อนั้น",
  },
  {
    title: "4. Design / Production",
    state: "IN_DESIGN -> IN_PRODUCTION",
    detail:
      "หลังปลด gate แล้ว flow จะวิ่งเข้าคิว design ops หรือ production ops พร้อมอัปเดตกลับไปหน้า status เดิมของลูกค้า",
  },
  {
    title: "5. Fulfillment",
    state: "READY_FOR_FULFILLMENT -> COMPLETED",
    detail:
      "ระบบปิดท้ายด้วยการส่งมอบ, ติดตั้ง หรือรับงาน พร้อมให้ลูกค้าเห็นสถานะสุดท้ายจาก token เดิม",
  },
] as const;

const queueOwnershipLanes = [
  {
    title: "New Leads",
    owner: "CRM / intake ops",
    description: "เก็บ requirement ให้พร้อมก่อนสร้าง quote หรือผลักเข้าสู่เคสยกเว้น",
  },
  {
    title: "Quote Decision",
    owner: "Sales / admin",
    description: "ตามใบเสนอราคา, การอนุมัติ, และการ rescope ก่อนเข้า payment lane",
  },
  {
    title: "Payment Ops",
    owner: "Finance",
    description: "ยืนยันการชำระ, manual review และปลด payment gate ก่อน flow จะวิ่งต่อ",
  },
  {
    title: "Commercial Gate",
    owner: "Finance & documents",
    description: "คุม receiver lock และเอกสาร receipt/tax invoice หลังรับชำระให้ตรงคนรับเงิน",
  },
  {
    title: "Customer Waiting",
    owner: "CRM / follow-up",
    description: "พัก flow แบบชัดเจนเมื่อกำลังรอข้อมูล, หลักฐาน หรือ feedback จากลูกค้า",
  },
  {
    title: "Design Ops / Production Ops",
    owner: "Design QA / fulfillment",
    description: "คุม proof, revision, production links และ fulfillment จนเสร็จสมบูรณ์",
  },
  {
    title: "Exceptions",
    owner: "Owner / reviewer",
    description: "เคสผิด policy หรือผิดเส้นทางจะถูกดึงออกมาให้คนตัดสินใจทันที ไม่ปล่อยไหลไปต่อ",
  },
] as const;

const documentSystemRails = [
  {
    title: "Document intent from intake",
    route: "/liff/intake + requested_document_type",
    description:
      "ลูกค้าเลือกตั้งแต่ intake ว่าต้องการใบเสนอราคา, receipt หรือ tax invoice และข้อมูล billing จะถูกเก็บเป็นต้นทางของเอกสารทั้งหมด",
  },
  {
    title: "Receiver selection",
    route: "/api/commercial/select-receiver",
    description:
      "ระบบเลือกผู้รับเงินและกันการเปลี่ยนชื่อเอกสารมั่วหลังยืนยัน payment เพื่อคุม invariant เงินเข้าใคร -> เอกสารออกชื่อนั้น",
  },
  {
    title: "Payment confirmation lock",
    route: "/api/payments/confirm",
    description:
      "เมื่อ payment ถูกยืนยัน ระบบจะล็อก receiver และเตรียม commercial order ให้พร้อมสำหรับการออกเอกสารหลังรับชำระ",
  },
  {
    title: "Commercial document issue",
    route: "/api/commercial/documents/issue",
    description:
      "ขั้นตอนนี้ตรวจ payment, receiver lock และสิทธิ์ของ entity ก่อนออก receipt หรือ tax invoice จริง",
  },
  {
    title: "Document delivery",
    route: "/commercial/documents/[id]/download",
    description:
      "เอกสารที่ออกแล้วจะถูกอ้างอิงกลับทั้งจากหน้า quote/status และฝั่งแอดมินเพื่อให้ audit trail ครบ",
  },
] as const;

const promptProductionRails = [
  {
    title: "Prompt seed from intake",
    route: "ai_image_prompt + ai_prompt_snapshot",
    description:
      "ดีไซน์เริ่มจาก prompt ที่มากับ design brief, note และ product context ไม่ได้เริ่มลอย ๆ ตอนถึงคิวออกแบบ",
  },
  {
    title: "Studio / prompt builder",
    route: "/studio",
    description:
      "ทีมใช้ studio surface กับ prompt actions เพื่อดู routing, prompt ที่ compose แล้ว และตัดสินใจว่าจะ generate หรือส่ง preview แบบไหน",
  },
  {
    title: "AI preview generation",
    route: "/api/leads/[id]/ai-preview",
    description:
      "เมื่อมี prompt พร้อม ระบบสร้างภาพตัวอย่างและเก็บสถานะ AI preview เพื่อให้เห็นว่า lead นี้อยู่ในช่วง design assist หรือยัง",
  },
  {
    title: "Preview to customer",
    route: "/api/leads/[id]/send-preview",
    description:
      "หลังคัดตัวอย่างแล้ว ทีมส่ง preview กลับไปให้ลูกค้าทาง flow เดิม และสถานะจะเชื่อมกับ customer waiting / design ops",
  },
  {
    title: "Production link + media review",
    route: "/production/[token] + job_media_events",
    description:
      "พอเข้า production ระบบจะมี production link, asset upload, review_status และหลักฐานส่งลูกค้าเป็นอีก rail หนึ่งที่วิ่งคู่กับ status page",
  },
] as const;

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

function RuntimeSurfaceCard({
  title,
  route,
  description,
}: {
  title: string;
  route: string;
  description: string;
}) {
  return (
    <div className="flow-theme-soft p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-3 inline-flex rounded-full bg-card px-3 py-1 text-xs font-semibold text-sky-700 [font-family:var(--font-flow-mono)]">
        {route}
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
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
            Runtime Workflow FOGUS
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Full flow map ของลูกค้าและทีมปฏิบัติการ
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/85 sm:text-base">
            หน้านี้ไม่ได้สรุปแค่ policy แล้ว แต่พยายามผูกของจริงในระบบเข้าด้วยกัน: surface ที่ลูกค้าเห็น,
            queue ที่ทีมดูแล, และ gate เชิงพาณิชย์ที่ต้องผ่านก่อนปล่อยงานเข้าผลิต
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="flow-theme-note px-4 py-4 text-sm leading-7 text-amber-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                หมายเหตุการใช้งาน
              </p>
              <p className="mt-2 rounded-xl bg-white/80 px-3 py-3 font-semibold">
                หน้านี้เป็น runtime map แบบ read-only ใช้ดู flow เต็ม ไม่ได้ใช้คลิกแก้สถานะงานโดยตรง
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
            ["#runtime-surfaces", "surface จริง"],
            ["#runtime-path", "runtime path"],
            ["#queue-lanes", "owner lanes"],
            ["#document-rail", "document rail"],
            ["#prompt-rail", "prompt rail"],
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
        <section id="runtime-surfaces" className="flow-theme-card scroll-mt-24 p-6">
          <SectionTitle
            eyebrow="Runtime surfaces"
            title="หน้าจริงที่ flow นี้วิ่งผ่าน"
            description="นี่คือ surface ที่ลูกค้าและทีมใช้จริงใน packet ปัจจุบัน ไม่ใช่หน้าสมมติสำหรับอธิบายอย่างเดียว"
          />

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {runtimeSurfaces.map((surface) => (
              <RuntimeSurfaceCard key={surface.route} {...surface} />
            ))}
          </div>
        </section>

        <section id="runtime-path" className="flow-theme-card scroll-mt-24 p-6">
          <SectionTitle
            eyebrow="Runtime path"
            title="เส้นทางจริงตั้งแต่เริ่มคุยจนจบงาน"
            description="มุมนี้สรุปให้เห็นทั้ง customer journey และ internal handoff ในลำดับเดียว โดยยึด flow packet ที่ใช้อยู่ตอนนี้"
          />

          <div className="grid gap-4 xl:grid-cols-5">
            {runtimeFlowStages.map((stage, index) => (
              <div key={stage.title} className="flow-theme-soft p-4">
                <p className="text-sm font-semibold text-foreground">{stage.title}</p>
                <div className="mt-3">
                  <StatePill label={stage.state} tone={index === runtimeFlowStages.length - 1 ? "terminal" : "default"} />
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{stage.detail}</p>
              </div>
            ))}
          </div>

          <div className="flow-theme-note mt-4 p-4 text-sm leading-7 text-amber-950">
            <p className="font-semibold">Commercial invariant</p>
            <p className="mt-2">
              เงินเข้าใคร -&gt; เอกสารออกชื่อนั้น. ดังนั้น approval อย่างเดียวไม่พอ ถ้า receiver lock หรือเอกสารหลังรับชำระยังไม่ครบ
              ระบบต้องค้างไว้ที่ payment/commercial lane ก่อนเสมอ
            </p>
          </div>
        </section>

        <section id="queue-lanes" className="flow-theme-card scroll-mt-24 p-6">
          <SectionTitle
            eyebrow="Owner lanes"
            title="คิว ownership ที่ต้องเห็นใน runtime packet นี้"
            description="ส่วนนี้ทำให้หน้า /flow สะท้อน queue model ใหม่ ไม่ใช่หยุดอยู่แค่ conversation state ใน policy file"
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {queueOwnershipLanes.map((lane) => (
              <div key={lane.title} className="flow-theme-soft p-4">
                <p className="text-sm font-semibold text-foreground">{lane.title}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">{lane.owner}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{lane.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="document-rail" className="flow-theme-card scroll-mt-24 p-6">
          <SectionTitle
            eyebrow="Document rail"
            title="เอกสารเชิงพาณิชย์เป็น flow ย่อยที่วิ่งคู่กับ quote"
            description="ส่วนนี้คือสิ่งที่หายไปถ้ามองแค่ customer page: เอกสารไม่ได้ตามมาทีหลังแบบ manual แต่มีระบบ receiver lock, payment confirm และ issue route ที่คุมอยู่จริง"
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {documentSystemRails.map((rail) => (
              <RuntimeSurfaceCard key={rail.route} {...rail} />
            ))}
          </div>

          <div className="flow-theme-note mt-4 p-4 text-sm leading-7 text-amber-950">
            <p className="font-semibold">สิ่งที่ flow นี้ป้องกัน</p>
            <p className="mt-2">
              ถ้าลูกค้าอนุมัติแล้วแต่ payment receiver ยังไม่ถูก lock หรือเอกสารยังไม่ถูก issue ระบบต้องไม่ปล่อย job เข้า production แม้ quote จะ approved แล้วก็ตาม
            </p>
          </div>
        </section>

        <section id="prompt-rail" className="flow-theme-card scroll-mt-24 p-6">
          <SectionTitle
            eyebrow="Prompt rail"
            title="ระบบ prompt, preview และ production proof ก็เป็นอีก flow หนึ่ง"
            description="นอกจากเอกสารแล้ว งานออกแบบของระบบนี้มี rail ของตัวเองตั้งแต่ prompt seed, studio routing, AI preview ไปจนถึง production media review"
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {promptProductionRails.map((rail) => (
              <RuntimeSurfaceCard key={rail.route} {...rail} />
            ))}
          </div>

          <div className="flow-theme-note mt-4 p-4 text-sm leading-7 text-amber-950">
            <p className="font-semibold">ความหมายเชิงระบบ</p>
            <p className="mt-2">
              คิว Design Ops และ Production Ops ไม่ได้หมายถึงแค่คนไปทำงานต่อ แต่รวม prompt พร้อมใช้, preview ที่ส่งลูกค้า, production link และหลักฐาน review ที่ย้อนกลับมาในระบบด้วย
            </p>
          </div>
        </section>

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
