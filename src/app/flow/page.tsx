import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Sans_Thai, JetBrains_Mono } from "next/font/google";

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
  title: "FOGUS Customer Flow",
  description: "ภาพรวม workflow สำหรับลูกค้าและทีมงาน FOGUS",
};

type StepTone = "line" | "liff" | "api" | "web" | "admin" | "esc";

type FlowStep = {
  id: string;
  number: string;
  title: string;
  badge: string;
  tone: StepTone;
  body: string[];
  detail?: string[];
  fields?: string[];
  state?: string;
  buttons?: Array<{ label: string; style: "primary" | "secondary" | "green" }>;
};

const navigation = [
  { href: "#customer", label: "ลูกค้า" },
  { href: "#admin", label: "แอดมิน" },
  { href: "#escalation", label: "Escalation" },
  { href: "#states", label: "States" },
  { href: "#routes", label: "Routes" },
  { href: "#db", label: "Database" },
  { href: "#checklist", label: "Checklist" },
];

const customerSteps: FlowStep[] = [
  {
    id: "customer-1",
    number: "1",
    title: "ลูกค้าส่งข้อความ",
    badge: "LINE Chat",
    tone: "line",
    body: [
      'ลูกค้าพิมพ์อะไรก็ได้ใน LINE OA เช่น "อยากทำป้าย", "สอบถามราคา" หรือ "สวัสดี"',
    ],
    detail: [
      "LINE Platform ส่ง webhook มาที่ /api/webhook พร้อม x-line-signature",
      "ระบบ verify signature ก่อน แล้วค่อยบันทึกข้อความลงฐานข้อมูลและตอบกลับ",
    ],
    state: "NEW_MESSAGE → COLLECTING_INFO",
  },
  {
    id: "customer-2",
    number: "2",
    title: "Bot ตอบ Flex Message",
    badge: "LINE Reply",
    tone: "line",
    body: [
      "ลูกค้าเห็นการ์ดสรุปพร้อมปุ่มสำหรับเริ่มกรอกฟอร์มหรือขอคุยกับแอดมิน",
      'ข้อความหลักคือ "สวัสดีค่ะ คุณ [ชื่อจาก LINE profile]!" และคำอธิบายว่ากรอกฟอร์มเพื่อรับใบเสนอราคา',
    ],
    detail: [
      "ปุ่มหลักเปิด LIFF ที่ https://liff.line.me/{LIFF_ID}/intake",
      'ปุ่มรองส่งข้อความ "ขอคุยกับแอดมิน" เพื่อเข้า escalation flow',
    ],
    buttons: [
      { label: "กรอกรายละเอียดงาน", style: "primary" },
      { label: "คุยกับแอดมิน", style: "secondary" },
    ],
  },
  {
    id: "customer-3",
    number: "3",
    title: "เปิด LIFF ใน LINE",
    badge: "LIFF v2.28",
    tone: "liff",
    body: [
      "หน้าจอเปิดเต็มจอใน LINE browser และเริ่ม flow การยืนยันตัวตนของ LIFF",
    ],
    detail: [
      "ลำดับที่ต้องเกิดคือ liff.init() → liff.requestFriendship() → liff.getProfile()",
      "LIFF endpoint ที่ลงทะเบียนไว้ต้องเป็น /liff และค่อย redirect ไป /liff/intake",
    ],
  },
  {
    id: "customer-4",
    number: "4",
    title: "กรอกฟอร์ม Intake",
    badge: "LIFF Form",
    tone: "liff",
    body: ["ฟอร์มเก็บข้อมูลทั้งหมดที่ต้องใช้ในการตีราคาและเปิดงานผลิต"],
    fields: [
      "ประเภทงาน (6 ตัวเลือก) *",
      "ขนาด กว้าง × สูง *",
      "หน่วย (มม./ซม./ม./นิ้ว/ฟุต)",
      "จำนวน",
      "วันที่ต้องการ",
      "เบอร์โทร *",
      "รายละเอียดเพิ่มเติม",
      "ลิงก์ไฟล์อ้างอิง",
    ],
    detail: [
      "ปุ่ม submit ต้องมี padding-bottom: env(safe-area-inset-bottom)",
      "จุดนี้สำคัญกับ Android edge-to-edge เพื่อไม่ให้ navigation bar บังปุ่ม",
    ],
  },
  {
    id: "customer-5",
    number: "5",
    title: "ส่งฟอร์ม → สร้าง Lead + Quote",
    badge: "POST /api/intake",
    tone: "api",
    body: [
      "API ทำ normalization หน่วยทั้งหมดเป็นมิลลิเมตร แล้ว upsert ข้อมูลลูกค้า",
      "จากนั้นสร้าง lead, คำนวณราคา, สร้าง quote และ quote_items พร้อม public token",
    ],
    detail: [
      "ถ้าข้อมูลไม่ครบ เช่น ไม่มี due_date หรือขนาดหลัง normalize ไม่ถูกต้อง จะไม่สร้าง quote",
      "กรณีนั้นระบบจะสร้าง escalation แทนเพื่อให้แอดมินตรวจต่อ",
    ],
    state: "FORM_SUBMITTED → WAITING_CUSTOMER_APPROVAL",
  },
  {
    id: "customer-6",
    number: "6",
    title: "LIFF แสดงผลสำเร็จ → ปิดอัตโนมัติ",
    badge: "LIFF",
    tone: "liff",
    body: [
      'ผู้ใช้เห็นข้อความยืนยันว่า "ส่งข้อมูลเรียบร้อยแล้ว" และระบบจะส่งใบเสนอราคาให้ทาง LINE',
    ],
    detail: ["หลังแสดงผลสำเร็จประมาณ 3 วินาที หน้า LIFF เรียก liff.closeWindow() แล้วกลับไปหน้าแชต"],
  },
  {
    id: "customer-7",
    number: "7",
    title: "ได้รับลิงก์ใบเสนอราคาทาง LINE",
    badge: "LINE Push",
    tone: "line",
    body: [
      "ลูกค้าได้รับ push message พร้อมสรุปรายการงาน ขนาด จำนวน และยอดรวมรวม VAT",
      "จากนั้นกดปุ่มเพื่อเปิดหน้าใบเสนอราคาแบบ public ได้ทันที",
    ],
    detail: ["การแจ้งเตือนขั้นนี้ใช้ LINE Push Message ไม่ใช่ Reply Message"],
    buttons: [{ label: "ดูใบเสนอราคา", style: "primary" }],
  },
  {
    id: "customer-8",
    number: "8",
    title: "เปิดหน้าใบเสนอราคา",
    badge: "GET /quote/:token",
    tone: "web",
    body: [
      "หน้า public แสดงข้อมูลลูกค้า รายละเอียดงาน รายการราคา VAT และวันหมดอายุของใบเสนอราคา",
      "ลูกค้าสามารถกดอนุมัติได้จากหน้าเดียวผ่าน public token",
    ],
    detail: [
      "public_token เป็น 32 hex chars สุ่มจาก gen_random_bytes(16) เพื่อเดายาก",
      "เมื่อกดอนุมัติ ระบบยิง POST /api/quotes/:id/approve",
    ],
    buttons: [{ label: "อนุมัติใบเสนอราคา", style: "green" }],
  },
  {
    id: "customer-9",
    number: "9",
    title: "อนุมัติ → สร้าง Job",
    badge: "POST /api/quotes/:id/approve",
    tone: "api",
    body: [
      "Quote และ lead ถูกอัปเดตเป็น approved จากนั้นสร้าง job และ job_timeline entry แรก",
      "สถานะ conversation ขยับเป็น JOB_CREATED เพื่อเข้าสู่ฝั่งการผลิต",
    ],
    state: "JOB_CREATED",
  },
  {
    id: "customer-10",
    number: "10",
    title: "ได้รับแจ้งเตือนสถานะ",
    badge: "LINE Push",
    tone: "line",
    body: [
      "ลูกค้าได้รับ push ทุกครั้งที่สถานะงานเปลี่ยน เช่น สร้างงานแล้ว, กำลังดำเนินการ, งานเสร็จสมบูรณ์",
      "ทุกข้อความควรมีลิงก์ /status/:token ให้ลูกค้าตรวจความคืบหน้าเองได้",
    ],
  },
  {
    id: "customer-11",
    number: "11",
    title: "เช็คสถานะงาน",
    badge: "GET /status/:token",
    tone: "web",
    body: [
      "หน้า public แสดงสถานะปัจจุบัน รายละเอียดงาน และ timeline ย้อนหลังตั้งแต่สร้างงานจนจบ",
    ],
    state: "COMPLETED",
  },
];

const adminSteps: FlowStep[] = [
  {
    id: "admin-a",
    number: "A",
    title: "Login",
    badge: "GET /auth/login",
    tone: "admin",
    body: [
      "แอดมินเข้าระบบด้วย Supabase Auth ผ่าน email และ password",
      "ถ้ายังไม่ล็อกอิน middleware จะ redirect มาที่หน้านี้ก่อนเข้า /admin",
    ],
  },
  {
    id: "admin-b",
    number: "B",
    title: "Dashboard",
    badge: "GET /admin",
    tone: "admin",
    body: [
      "หน้า dashboard รวม KPI, escalations, jobs, quotes, leads และ recent conversations ในหน้าเดียว",
      "แอดมินเปลี่ยนสถานะ job ได้จาก dropdown และระบบส่ง LINE push ทันที",
    ],
    detail: [
      "โซน escalation ใช้เป็นแถบแดงสำหรับเคสที่ต้องตามต่อเอง",
      "quote และ status page ทุกตัวเปิดลิงก์ public ให้ตรวจจากฝั่งลูกค้าได้",
    ],
  },
];

const escalationSteps: FlowStep[] = [
  {
    id: "esc-1",
    number: "E1",
    title: "ลูกค้าขอคุยกับแอดมิน",
    badge: "Escalation",
    tone: "esc",
    body: [
      'Webhook ตรวจ keyword เช่น "คุยกับคน", "คุยกับแอดมิน" และ "admin"',
      "ถ้าตรงเงื่อนไข ระบบสร้าง escalation, เปลี่ยน state เป็น HUMAN_REVIEW_REQUIRED และตอบกลับว่าทีมงานจะติดต่อกลับ",
    ],
    state: "HUMAN_REVIEW_REQUIRED",
  },
  {
    id: "esc-2",
    number: "E2",
    title: "Intake ข้อมูลไม่ครบ",
    badge: "Auto-escalation",
    tone: "esc",
    body: [
      "ถ้า due date หายหรือขนาดหลัง normalize ไม่ถูกต้อง ระบบจะสร้าง lead แต่ไม่ออก quote",
      "จากนั้นเปิด escalation เพื่อให้แอดมินตรวจและจัดการต่อด้วยมือ",
    ],
    state: "HUMAN_REVIEW_REQUIRED",
  },
];

const stateFlow = [
  "NEW_MESSAGE",
  "COLLECTING_INFO",
  "FORM_SUBMITTED",
  "QUOTE_DRAFTED",
  "WAITING_CUSTOMER_APPROVAL",
  "JOB_CREATED",
  "IN_PROGRESS",
  "COMPLETED",
];

const routes = [
  ["POST", "/api/webhook", "LINE signature", "รับ webhook จาก LINE"],
  ["POST", "/api/intake", "None (LIFF)", "รับข้อมูลจากฟอร์ม"],
  ["POST", "/api/quotes/[id]/approve", "Public token", "อนุมัติใบเสนอราคา"],
  ["POST", "/api/jobs/[id]/status", "Admin auth", "เปลี่ยนสถานะงาน"],
  ["GET", "/liff", "None", "LIFF endpoint และ redirect"],
  ["GET", "/liff/intake", "LIFF login", "ฟอร์ม intake"],
  ["GET", "/quote/[token]", "Public token", "หน้าใบเสนอราคา"],
  ["GET", "/status/[token]", "Public token", "หน้าสถานะงาน"],
  ["GET", "/auth/login", "None", "หน้า login แอดมิน"],
  ["GET", "/admin", "Supabase Auth", "หน้า dashboard"],
];

const databaseTables = [
  "conversations",
  "messages",
  "customers",
  "leads",
  "quotes",
  "quote_items",
  "jobs",
  "job_timeline",
  "escalations",
];

const checklistItems = [
  "Webhook ผ่านการ verify signature และตอบ 200 ได้เมื่อ signature ถูกต้อง",
  "Webhook ตอบ 401 เมื่อ signature ไม่ถูกต้อง",
  "ลูกค้าส่งข้อความแล้ว bot ตอบ Flex Message พร้อมลิงก์ LIFF",
  "LIFF เปิดเต็มหน้าจอใน LINE app",
  "liff.requestFriendship() ถูกเรียกหลัง liff.init()",
  "ปุ่ม submit ไม่โดน safe area ด้านล่างบังบน Android",
  "submit intake แล้ว lead กับ quote ถูกสร้างในฐานข้อมูล",
  "ลูกค้าได้รับ quote link ทาง LINE push",
  "หน้า /quote/:token เปิดดูได้และกด approve ได้",
  "approve แล้วสร้าง job และ job_timeline entry แรก",
  "ลูกค้าได้รับแจ้งเตือนเมื่อ approve สำเร็จ",
  "หน้า /status/:token แสดงสถานะและ timeline ได้ครบ",
  "หน้า /admin บังคับ login ก่อนเข้า",
  "หน้า /admin เห็น leads, quotes, jobs และ escalations ครบ",
  "เปลี่ยนสถานะ job แล้วมี LINE push notification",
  'พิมพ์ "คุยกับแอดมิน" แล้วเกิด escalation row พร้อมข้อความตอบกลับ',
  "intake ข้อมูลไม่ครบแล้วเกิด auto-escalation โดยไม่สร้าง quote",
  "conversation state ขยับครบตาม workflow",
];

function toneClasses(tone: StepTone) {
  switch (tone) {
    case "line":
      return {
        icon: "bg-emerald-100 text-emerald-600",
        badge: "bg-emerald-100 text-emerald-700",
      };
    case "liff":
      return {
        icon: "bg-violet-100 text-violet-700",
        badge: "bg-violet-100 text-violet-700",
      };
    case "api":
      return {
        icon: "bg-slate-200 text-slate-800",
        badge: "bg-slate-200 text-slate-800",
      };
    case "web":
      return {
        icon: "bg-blue-100 text-blue-700",
        badge: "bg-blue-100 text-blue-700",
      };
    case "admin":
      return {
        icon: "bg-amber-100 text-amber-700",
        badge: "bg-amber-100 text-amber-700",
      };
    case "esc":
      return {
        icon: "bg-rose-100 text-rose-700",
        badge: "bg-rose-100 text-rose-700",
      };
  }
}

function buttonClasses(style: "primary" | "secondary" | "green") {
  switch (style) {
    case "primary":
      return "bg-slate-950 text-white";
    case "secondary":
      return "border border-slate-200 bg-slate-100 text-slate-700";
    case "green":
      return "bg-emerald-500 text-white";
  }
}

function StepCard({ step }: { step: FlowStep }) {
  const tones = toneClasses(step.tone);

  return (
    <div className="rounded-3xl border border-[#e8e6df] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <div className="mb-3 flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${tones.icon}`}>
          {step.number}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">{step.title}</h3>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.12em] ${tones.badge}`}>
              {step.badge}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2 text-sm leading-7 text-slate-600">
        {step.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {step.buttons ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {step.buttons.map((button) => (
            <span
              key={button.label}
              className={`inline-flex rounded-xl px-4 py-2 text-xs font-medium ${buttonClasses(button.style)}`}
            >
              {button.label}
            </span>
          ))}
        </div>
      ) : null}

      {step.fields ? (
        <div className="mt-4 grid gap-x-6 gap-y-1 rounded-2xl bg-[#f5f4f0] px-4 py-4 text-sm text-slate-600 sm:grid-cols-2">
          {step.fields.map((field) => (
            <div key={field} className="border-b border-[#ebe8e1] py-2 last:border-b-0 sm:last:border-b">
              → {field}
            </div>
          ))}
        </div>
      ) : null}

      {step.detail ? (
        <div className="mt-4 rounded-2xl bg-[#f5f4f0] px-4 py-4 text-sm leading-6 text-slate-600">
          <div className="space-y-2">
            {step.detail.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
      ) : null}

      {step.state ? (
        <div className="mt-4 inline-flex rounded-full bg-blue-50 px-4 py-2 font-mono text-xs font-semibold tracking-[0.08em] text-blue-700">
          {step.state}
        </div>
      ) : null}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex flex-col items-center py-2">
      <div className="h-5 w-px bg-[#d8d5cb]" />
      <div className="h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-slate-400" />
    </div>
  );
}

export default function FlowPage() {
  return (
    <main className={`${plexSansThai.variable} ${jetBrainsMono.variable} min-h-screen bg-[#fafaf8] text-slate-950 [font-family:var(--font-flow-sans)]`}>
      <section className="relative overflow-hidden bg-[#1a1a2e] px-6 py-16 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(245,158,11,0.16),transparent_24%),radial-gradient(circle_at_78%_70%,rgba(16,185,129,0.18),transparent_28%)]" />
        <div className="relative mx-auto max-w-5xl">
          <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium tracking-[0.2em] text-white/80 uppercase">
            FOGUS Workflow Review
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Customer Flow สำหรับใช้คุยกับลูกค้าและตรวจงานในทีม
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
            หน้าเดียวสรุปตั้งแต่ลูกค้าทัก LINE, เปิด LIFF, ส่งข้อมูล, รับใบเสนอราคา, อนุมัติงาน ไปจนถึงการติดตามสถานะงานจากหน้า public และฝั่งแอดมิน
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-[#1a1a2e] transition hover:bg-white/90"
            >
              ไปหน้าแอดมิน
            </Link>
            <a
              href="#checklist"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              ดู smoke checklist
            </a>
          </div>
        </div>
      </section>

      <nav className="sticky top-0 z-20 border-b border-[#e8e6df] bg-[#fafaf8]/90 px-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto py-3 text-sm text-slate-500">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full px-4 py-2 transition hover:bg-white hover:text-slate-950"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
        <section id="customer" className="scroll-mt-24 py-4">
          <SectionTitle title="Customer Journey" subtitle="ฝั่งลูกค้า" />
          <div className="space-y-0">
            {customerSteps.map((step, index) => (
              <div key={step.id}>
                <StepCard step={step} />
                {index < customerSteps.length - 1 ? <Connector /> : null}
              </div>
            ))}
          </div>
        </section>

        <Divider />

        <section id="admin" className="scroll-mt-24 py-4">
          <SectionTitle title="Admin Journey" subtitle="ฝั่งแอดมิน" />
          <div className="space-y-4">
            {adminSteps.map((step) => (
              <StepCard key={step.id} step={step} />
            ))}
          </div>
        </section>

        <Divider />

        <section id="escalation" className="scroll-mt-24 py-4">
          <SectionTitle title="Escalation Paths" subtitle="ทางแยกที่ต้องตามงาน" />
          <div className="space-y-4">
            {escalationSteps.map((step) => (
              <StepCard key={step.id} step={step} />
            ))}
          </div>
        </section>

        <Divider />

        <section id="states" className="scroll-mt-24 py-4">
          <SectionTitle title="Workflow States" subtitle="สถานะทั้งหมด" />
          <div className="rounded-3xl border border-[#e8e6df] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">Happy path</h3>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 [font-family:var(--font-flow-mono)]">
              {stateFlow.map((state, index) => (
                <div key={state} className="contents">
                  <span className={`rounded-lg px-3 py-2 ${state === "COMPLETED" ? "bg-slate-950 text-white" : "bg-[#f5f4f0] text-slate-700"}`}>
                    {state}
                  </span>
                  {index < stateFlow.length - 1 ? <span className="px-1 text-slate-400">→</span> : null}
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-rose-50 px-4 py-4 text-sm text-rose-700">
              <p className="font-semibold">Branch</p>
              <p className="mt-2">ทุกสถานะสามารถแยกไป HUMAN_REVIEW_REQUIRED ได้เมื่อเจอ keyword escalation หรือ intake data ไม่ครบ</p>
            </div>
          </div>
        </section>

        <Divider />

        <section id="routes" className="scroll-mt-24 py-4">
          <SectionTitle title="Routes" subtitle="เส้นทาง API และหน้า public" />
          <div className="overflow-hidden rounded-3xl border border-[#e8e6df] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f5f4f0] text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Auth</th>
                    <th className="px-4 py-3">หน้าที่</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map(([method, route, auth, description]) => (
                    <tr key={route} className="border-t border-[#efede7] text-slate-600">
                      <td className="px-4 py-3">
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold [font-family:var(--font-flow-mono)] ${method === "POST" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                          {method}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-950 [font-family:var(--font-flow-mono)]">{route}</td>
                      <td className="px-4 py-3">{auth}</td>
                      <td className="px-4 py-3">{description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#efede7] bg-[#f5f4f0] px-4 py-4 text-sm text-slate-600">
              ทุก dynamic route ต้องใช้ await props.params ตามข้อบังคับของ Next.js 16
            </div>
          </div>
        </section>

        <Divider />

        <section id="db" className="scroll-mt-24 py-4">
          <SectionTitle title="Database" subtitle="9 tables หลัก" />
          <div className="rounded-3xl border border-[#e8e6df] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {databaseTables.map((table) => (
                <div
                  key={table}
                  className="rounded-2xl bg-[#f5f4f0] px-4 py-3 text-sm font-medium text-slate-800 [font-family:var(--font-flow-mono)]"
                >
                  {table}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-[#f5f4f0] px-4 py-4 text-sm leading-7 text-slate-600">
              <p>Realtime ที่ใช้งาน: conversations, jobs, escalations</p>
              <p>Supabase key ที่ใช้ต้องเป็น sb_publishable_... สำหรับ client และ sb_secret_... สำหรับ server-only</p>
            </div>
          </div>
        </section>

        <Divider />

        <section id="checklist" className="scroll-mt-24 py-4">
          <SectionTitle title="Smoke Checklist" subtitle="ใช้ตรวจงานก่อนส่งจริง" />
          <div className="rounded-3xl border border-[#e8e6df] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <ul className="space-y-1 text-sm leading-7 text-slate-600">
              {checklistItems.map((item) => (
                <li key={item} className="flex gap-3 border-b border-[#efede7] py-3 last:border-b-0">
                  <span className="text-slate-400">☐</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <footer className="border-t border-[#e8e6df] px-6 py-10 text-center text-sm leading-7 text-slate-500">
        <p>FOGUS ERP 2026 · Next.js 16.2 · Supabase · LINE LIFF v2.28 · Vercel</p>
        <p>หน้านี้ทำไว้สำหรับใช้รีวิว flow ร่วมกันก่อนขึ้นงานจริงและก่อนปล่อยให้ลูกค้าใช้งาน</p>
      </footer>
    </main>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{title}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-950">{subtitle}</h2>
      </div>
      <div className="h-px flex-1 bg-[#e8e6df]" />
    </div>
  );
}

function Divider() {
  return <div className="my-10 h-px bg-[#e8e6df]" />;
}