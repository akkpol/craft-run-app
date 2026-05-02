const BANGKOK_DATE_FORMATTER = new Intl.DateTimeFormat("th-TH-u-nu-latn", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const BANGKOK_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("th-TH-u-nu-latn", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function asValidDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateParts(date: Date) {
  const parts = BANGKOK_DATE_FORMATTER.formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;

  if (!day || !month || !year) {
    return null;
  }

  return `${day}/${month}/${year}`;
}

function formatTimeParts(date: Date) {
  const parts = BANGKOK_DATE_TIME_FORMATTER.formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  const second = parts.find((part) => part.type === "second")?.value;

  if (!hour || !minute || !second) {
    return null;
  }

  return `${hour}:${minute}:${second}`;
}

export function formatBangkokDate(value: string | null | undefined) {
  const date = asValidDate(value);

  if (!date) {
    return "-";
  }

  return formatDateParts(date) || "-";
}

export function formatBangkokDateTime(value: string | null | undefined) {
  const date = asValidDate(value);

  if (!date) {
    return "-";
  }

  const dateLabel = formatDateParts(date);
  const timeLabel = formatTimeParts(date);

  if (!dateLabel || !timeLabel) {
    return "-";
  }

  return `${dateLabel} ${timeLabel}`;
}