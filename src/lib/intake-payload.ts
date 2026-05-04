import {
  getPrimaryDocumentRequestType,
  normalizeDocumentRequestTypes,
} from "@/lib/document-request";
import type { IntakeFormData } from "@/lib/types";

export function parseOptionalNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  return null;
}

function getFormDataString(formData: FormData, name: string) {
  return String(formData.get(name) || "");
}

function getOptionalFormDataString(formData: FormData, name: string) {
  const value = getFormDataString(formData, name);
  return value || undefined;
}

export function parseMultipartIntakeFormData(formData: FormData) {
  const customerMediaFiles = formData
    .getAll("referenceFiles")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const requestedDocumentTypes = normalizeDocumentRequestTypes([
    ...formData.getAll("requestedDocumentTypes"),
    getOptionalFormDataString(formData, "requestedDocumentType"),
  ]);

  const data: IntakeFormData = {
    liffIdToken: getOptionalFormDataString(formData, "liffIdToken"),
    liffAccessToken: getOptionalFormDataString(formData, "liffAccessToken"),
    liffContextSnapshot: getOptionalFormDataString(formData, "liffContextSnapshot"),
    productType: getFormDataString(formData, "productType"),
    width: Number(getFormDataString(formData, "width")),
    height: Number(getFormDataString(formData, "height")),
    unit: getFormDataString(formData, "unit") as IntakeFormData["unit"],
    qty: Number(getFormDataString(formData, "qty")) || 1,
    dueDate: getFormDataString(formData, "dueDate"),
    phone: getFormDataString(formData, "phone"),
    requestedDocumentType:
      getPrimaryDocumentRequestType(requestedDocumentTypes),
    requestedDocumentTypes,
    designBrief: getOptionalFormDataString(formData, "designBrief"),
    note: getFormDataString(formData, "note"),
    referenceInfo: getFormDataString(formData, "referenceInfo"),
    billingEntityType:
      getOptionalFormDataString(formData, "billingEntityType") as IntakeFormData["billingEntityType"],
    billingBranchType:
      getOptionalFormDataString(formData, "billingBranchType") as IntakeFormData["billingBranchType"],
    billingBranchCode: getOptionalFormDataString(formData, "billingBranchCode"),
    billingName: getOptionalFormDataString(formData, "billingName"),
    taxId: getOptionalFormDataString(formData, "taxId"),
    billingAddress: getOptionalFormDataString(formData, "billingAddress"),
    fulfillmentMode:
      getOptionalFormDataString(formData, "fulfillmentMode") as IntakeFormData["fulfillmentMode"],
    fulfillmentAddressLine1: getOptionalFormDataString(formData, "fulfillmentAddressLine1"),
    fulfillmentAddressLine2: getOptionalFormDataString(formData, "fulfillmentAddressLine2"),
    fulfillmentSubdistrict: getOptionalFormDataString(formData, "fulfillmentSubdistrict"),
    fulfillmentDistrict: getOptionalFormDataString(formData, "fulfillmentDistrict"),
    fulfillmentProvince: getOptionalFormDataString(formData, "fulfillmentProvince"),
    fulfillmentPostalCode: getOptionalFormDataString(formData, "fulfillmentPostalCode"),
    fulfillmentLatitude: parseOptionalNumber(getFormDataString(formData, "fulfillmentLatitude")) ?? undefined,
    fulfillmentLongitude: parseOptionalNumber(getFormDataString(formData, "fulfillmentLongitude")) ?? undefined,
    aiImagePrompt: getOptionalFormDataString(formData, "aiImagePrompt"),
    intakeMode: getOptionalFormDataString(formData, "intakeMode") as IntakeFormData["intakeMode"],
  };

  return { data, customerMediaFiles };
}

export function buildLeadPromptFields(
  data: Pick<IntakeFormData, "designBrief" | "note" | "referenceInfo" | "aiImagePrompt">
) {
  const aiImagePrompt = data.aiImagePrompt || null;

  return {
    design_brief: data.designBrief || null,
    note_from_form: data.note || null,
    reference_info: data.referenceInfo || null,
    ai_image_prompt: aiImagePrompt,
    ai_image_status: aiImagePrompt ? "pending" : "not_requested",
  };
}