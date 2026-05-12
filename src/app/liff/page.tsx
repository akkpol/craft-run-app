import { redirect } from "next/navigation";

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
	const includeDevOnlyParams = process.env.NODE_ENV !== "production";

	for (const key of [
		"category",
		"product",
		"productType",
		"mode",
	]) {
		const value = firstValue(searchParams[key]);
		if (value) {
			params.set(key, value);
		}
	}

	if (includeDevOnlyParams) {
		for (const key of ["devNoLiff", "lineUserId"]) {
			const value = firstValue(searchParams[key]);
			if (value) {
				params.set(key, value);
			}
		}
	}

	const query = params.toString();
	return query ? `/liff/intake?${query}` : "/liff/intake";
}

export default async function LiffEntryPage(props: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const searchParams = await props.searchParams;
	const intakeHref = buildIntakeHref(searchParams);
	redirect(intakeHref);
}
