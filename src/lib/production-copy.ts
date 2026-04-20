import { type AppLocale } from "@/lib/locale";

export interface ProductionUploadFormCopy {
  eventTypeLabel: string;
  submittedByLabel: string;
  submittedByPlaceholder: string;
  noteLabel: string;
  notePlaceholder: string;
  filesLabel: string;
  filesHint: string;
  uploadFailed: string;
  successMessage: string;
  submitLoadingLabel: string;
  submitIdleLabel: string;
}

export interface ProductionPageCopy {
  invalidTitle: string;
  invalidDescription: string;
  headerEyebrow: string;
  headerFallbackTitle: string;
  headerDescription: string;
  languageLabel: string;
  jobLabel: string;
  customerNameLabel: string;
  uploadStatusLabel: string;
  uploadEnabledLabel: string;
  uploadDisabledLabel: string;
  unknownProductLabel: string;
  unknownValueLabel: string;
  uploadPausedMessage: string;
  formTitle: string;
  formDescription: string;
  form: ProductionUploadFormCopy;
}

const PRODUCTION_PAGE_COPY: Record<AppLocale, ProductionPageCopy> = {
  th: {
    invalidTitle: "ลิงก์นี้ใช้งานไม่ได้",
    invalidDescription:
      "ลิงก์อาจหมดอายุ ถูกยกเลิก หรือไม่ถูกต้อง กรุณาติดต่อแอดมินเพื่อรับลิงก์ใหม่",
    headerEyebrow: "Production Link",
    headerFallbackTitle: "งานหน้างาน",
    headerDescription:
      "ส่งรูปหลักฐานและอัปเดตสถานะงานเข้าระบบได้ทันทีจากมือถือ",
    languageLabel: "ภาษา",
    jobLabel: "งาน",
    customerNameLabel: "ชื่อลูกค้า",
    uploadStatusLabel: "สถานะ upload",
    uploadEnabledLabel: "เปิดใช้งาน",
    uploadDisabledLabel: "ปิดชั่วคราว",
    unknownProductLabel: "ไม่ระบุสินค้า",
    unknownValueLabel: "ไม่ระบุ",
    uploadPausedMessage:
      "ระบบปิดรับ upload ชั่วคราว กรุณาติดต่อแอดมินเพื่อส่งงานผ่านช่องทาง fallback",
    formTitle: "ส่งหลักฐานงาน",
    formDescription:
      "หลักฐานที่ส่งเข้ามาจะยังไม่ถูกส่งถึงลูกค้าทันที จนกว่าแอดมินจะตรวจสอบ",
    form: {
      eventTypeLabel: "ประเภทหลักฐาน",
      submittedByLabel: "ชื่อผู้ส่ง",
      submittedByPlaceholder: "เช่น ฝ่ายผลิต A",
      noteLabel: "หมายเหตุ",
      notePlaceholder: "เช่น งานพิมพ์ผ่านแล้ว รอเข้าเครื่อง",
      filesLabel: "รูปหลักฐาน",
      filesHint:
        "รองรับหลายรูปในครั้งเดียว และจะส่งเข้า queue รอแอดมินตรวจสอบก่อน",
      uploadFailed: "Upload failed",
      successMessage:
        "อัปโหลดหลักฐานเรียบร้อยแล้ว รอแอดมินตรวจสอบก่อนส่งลูกค้า",
      submitLoadingLabel: "กำลังอัปโหลด...",
      submitIdleLabel: "ส่งหลักฐานเข้าคิวตรวจ",
    },
  },
  my: {
    invalidTitle: "ဤလင့်ခ်ကို အသုံးမပြုနိုင်ပါ",
    invalidDescription:
      "ဤလင့်ခ်သည် သက်တမ်းကုန်၊ ပယ်ဖျက်ထားခြင်း သို့မဟုတ် မမှန်ကန်ခြင်း ဖြစ်နိုင်ပါသည်။ လင့်ခ်အသစ်ရယူရန် admin ကို ဆက်သွယ်ပါ။",
    headerEyebrow: "ထုတ်လုပ်ရေးလင့်ခ်",
    headerFallbackTitle: "ထုတ်လုပ်ရေးအလုပ်",
    headerDescription:
      "မိုဘိုင်းဖုန်းမှ အထောက်အထားဓာတ်ပုံနှင့် အလုပ်အခြေအနေကို တိုက်ရိုက်တင်နိုင်ပါသည်။",
    languageLabel: "ဘာသာစကား",
    jobLabel: "အလုပ်",
    customerNameLabel: "ဖောက်သည်အမည်",
    uploadStatusLabel: "အပ်လုဒ်အခြေအနေ",
    uploadEnabledLabel: "ဖွင့်ထားသည်",
    uploadDisabledLabel: "ယာယီပိတ်ထားသည်",
    unknownProductLabel: "ကုန်ပစ္စည်း မသတ်မှတ်ထားပါ",
    unknownValueLabel: "မသတ်မှတ်ထားပါ",
    uploadPausedMessage:
      "Upload ကို ယာယီပိတ်ထားပါသည်။ fallback channel ဖြင့်ပို့ရန် admin ကို ဆက်သွယ်ပါ။",
    formTitle: "အလုပ်အထောက်အထား တင်ရန်",
    formDescription:
      "ဤနေရာမှတင်သောအရာများကို admin စစ်ဆေးပြီးမှသာ ဖောက်သည်ထံ ပို့ပါမည်။",
    form: {
      eventTypeLabel: "အထောက်အထားအမျိုးအစား",
      submittedByLabel: "တင်ပို့သူ",
      submittedByPlaceholder: "ဥပမာ Production team A",
      noteLabel: "မှတ်ချက်",
      notePlaceholder: "ဥပမာ ပရင့်စစ်ပြီး၊ စက်တင်ရန် စောင့်နေသည်",
      filesLabel: "အထောက်အထားပုံ",
      filesHint:
        "တစ်ကြိမ်တည်းဖြင့် ပုံများစွာတင်နိုင်သည်။ ပထမဦးစွာ admin review queue ထဲသို့ ဝင်ပါမည်။",
      uploadFailed: "အပ်လုဒ် မအောင်မြင်ပါ",
      successMessage:
        "အထောက်အထားကို လက်ခံပြီးပါပြီ။ admin စစ်ဆေးပြီးမှ ဖောက်သည်ထံ ပို့ပါမည်။",
      submitLoadingLabel: "အပ်လုဒ်လုပ်နေသည်...",
      submitIdleLabel: "စစ်ဆေးရန် တင်ပို့မည်",
    },
  },
  en: {
    invalidTitle: "This link is not available",
    invalidDescription:
      "The link may be expired, revoked, or invalid. Please contact the admin for a new one.",
    headerEyebrow: "Production Link",
    headerFallbackTitle: "Production Job",
    headerDescription:
      "Upload production evidence and status updates directly from your phone.",
    languageLabel: "Language",
    jobLabel: "Job",
    customerNameLabel: "Customer",
    uploadStatusLabel: "Upload status",
    uploadEnabledLabel: "Enabled",
    uploadDisabledLabel: "Temporarily unavailable",
    unknownProductLabel: "Unspecified product",
    unknownValueLabel: "Not available",
    uploadPausedMessage:
      "Uploads are temporarily disabled. Please contact the admin and use the fallback channel.",
    formTitle: "Upload production evidence",
    formDescription:
      "Items uploaded here will stay in review until an admin approves them.",
    form: {
      eventTypeLabel: "Evidence type",
      submittedByLabel: "Submitted by",
      submittedByPlaceholder: "e.g. Production team A",
      noteLabel: "Note",
      notePlaceholder: "e.g. Print approved, waiting for machine run",
      filesLabel: "Evidence photos",
      filesHint:
        "You can upload multiple photos at once. They will go into the admin review queue first.",
      uploadFailed: "Upload failed",
      successMessage:
        "Upload received. The admin will review it before sending it to the customer.",
      submitLoadingLabel: "Uploading...",
      submitIdleLabel: "Submit for review",
    },
  },
};

export function getProductionPageCopy(locale: AppLocale): ProductionPageCopy {
  return PRODUCTION_PAGE_COPY[locale] ?? PRODUCTION_PAGE_COPY.my;
}