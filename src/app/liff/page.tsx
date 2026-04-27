import Link from "next/link";
import {
	ArrowRight,
	CalendarDays,
	Package2,
	Paperclip,
	ScrollText,
} from "lucide-react";

import { getRuntimeAppConfig } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

function firstValue(
	value: string | string[] | undefined
): string | undefined {
	if (Array.isArray(value)) {
		return value[0];
	}

	return value;
}

function buildIntakeHref(searchParams: Record<string, string | string[] | undefined>) {
	const params = new URLSearchParams();

	for (const key of [
		"category",
		"product",
		"productType",
		"mode",
		"devNoLiff",
		"lineUserId",
	]) {
		const value = firstValue(searchParams[key]);
		if (value) {
			params.set(key, value);
		}
	}

	const query = params.toString();
	return query ? `/liff/intake?${query}` : "/liff/intake";
}

export default async function LiffEntryPage(props: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const config = await getRuntimeAppConfig();
	const searchParams = await props.searchParams;
	const intakeHref = buildIntakeHref(searchParams);
	const initialProduct =
		firstValue(searchParams.product) || firstValue(searchParams.productType);
	const mode = firstValue(searchParams.mode) === "fresh" ? "fresh" : "resume";
	const businessName = config.businessName || "FOGUS";

	return (
		<div className="px-3 py-4">
			<div className="mx-auto max-w-lg space-y-4">
				<section className="flow-theme-card overflow-hidden">
					<div className="liff-flow-hero px-4 py-5 text-white">
						<div className="flex items-center justify-between gap-2">
							<span className="inline-flex rounded-full border border-white/18 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/88 backdrop-blur-sm">
								LINE MINI App
							</span>
							<span className="inline-flex rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/78 backdrop-blur-sm">
								{mode === "fresh" ? "เริ่มใหม่" : "พร้อมกรอกต่อ"}
							</span>
						</div>

						<div className="mt-4 min-w-0">
							<h1 className="text-[24px] font-semibold leading-tight text-white">
								เริ่มส่งงานกับ {businessName}
							</h1>
							<p className="mt-2 text-sm leading-6 text-slate-200">
								หน้านี้เป็นจุดเริ่มต้นสั้น ๆ ก่อนเข้าฟอร์มจริง ช่วยให้ลูกค้าเห็นว่าต้องเตรียมอะไรและกดเข้าแบบเต็มเมื่อพร้อม
							</p>
						</div>

						<div className="mt-4 flex flex-wrap gap-2">
							<span className="rounded-lg bg-white/12 px-2.5 py-1.5 text-[11px] font-medium text-white/84 backdrop-blur-sm">
								เลือกประเภทงาน
							</span>
							<span className="rounded-lg bg-white/12 px-2.5 py-1.5 text-[11px] font-medium text-white/84 backdrop-blur-sm">
								ใส่ขนาดและวันใช้งาน
							</span>
							<span className="rounded-lg bg-white/12 px-2.5 py-1.5 text-[11px] font-medium text-white/84 backdrop-blur-sm">
								แนบไฟล์ถ้ามี
							</span>
						</div>
					</div>
				</section>

				<section className="liff-panel p-4">
					<div className="grid grid-cols-3 gap-2">
						<div className="rounded-2xl bg-sky-50/90 px-3 py-3 text-sky-950">
							<div className="flex items-center gap-2 text-[11px] font-medium text-sky-900/75">
								<Package2 className="size-3.5" aria-hidden="true" />
								<span>ขั้น 1</span>
							</div>
							<p className="mt-2 text-sm font-semibold leading-5">เลือกงาน</p>
						</div>
						<div className="rounded-2xl bg-slate-50/90 px-3 py-3 text-slate-950">
							<div className="flex items-center gap-2 text-[11px] font-medium text-slate-900/75">
								<CalendarDays className="size-3.5" aria-hidden="true" />
								<span>ขั้น 2</span>
							</div>
							<p className="mt-2 text-sm font-semibold leading-5">ใส่วันและขนาด</p>
						</div>
						<div className="rounded-2xl bg-amber-50/90 px-3 py-3 text-amber-950">
							<div className="flex items-center gap-2 text-[11px] font-medium text-amber-900/75">
								<Paperclip className="size-3.5" aria-hidden="true" />
								<span>ขั้น 3</span>
							</div>
							<p className="mt-2 text-sm font-semibold leading-5">แนบไฟล์</p>
						</div>
					</div>

					<div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4">
						<div className="flex items-start gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
								<ScrollText className="size-5" aria-hidden="true" />
							</div>
							<div className="min-w-0">
								<p className="text-sm font-semibold text-slate-900">ก่อนเข้าฟอร์ม</p>
								<p className="mt-1 text-xs leading-5 text-slate-600">
									เตรียมประเภทงาน ขนาด จำนวน วันที่ต้องใช้ และไฟล์ตัวอย่างถ้ามี ระบบจะช่วยพาไปยังฟอร์มเต็มในขั้นถัดไป
								</p>
								{initialProduct ? (
									<p className="mt-2 text-xs font-medium text-sky-700">
										เข้ามาพร้อมสินค้าเบื้องต้น: {initialProduct}
									</p>
								) : null}
							</div>
						</div>
					</div>
				</section>

				<section className="flow-theme-card p-4">
					<Link
						href={intakeHref}
						className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
					>
						<span>{mode === "fresh" ? "เริ่มกรอกงานใหม่" : "ไปที่ฟอร์มรายละเอียด"}</span>
						<ArrowRight className="size-4" aria-hidden="true" />
					</Link>
					<p className="mt-3 text-center text-xs leading-5 text-slate-500">
						ถ้าเคยคุยหรือส่งงานไว้ก่อนหน้า ระบบจะช่วยเติมข้อมูลล่าสุดบางส่วนให้ในหน้าฟอร์มจริง
					</p>
				</section>
			</div>
		</div>
	);
}
