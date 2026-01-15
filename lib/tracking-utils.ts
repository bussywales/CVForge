export function isFollowupDue(nextFollowupAt: string | null, now = new Date()) {
  if (!nextFollowupAt) {
    return false;
  }
  const parsed = new Date(nextFollowupAt);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.getTime() <= now.getTime();
}

export function isDueToday(
  value: string | null,
  timeZone = "Europe/London",
  now = new Date()
) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return false;
  }
  const todayKey = toDateKey(now, timeZone);
  const valueKey = toDateKey(parsed, timeZone);
  return valueKey === todayKey;
}

export function isOverdue(
  value: string | null,
  timeZone = "Europe/London",
  now = new Date()
) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return false;
  }
  const todayKey = toDateKey(now, timeZone);
  const valueKey = toDateKey(parsed, timeZone);
  return valueKey < todayKey;
}

export function deriveNeedsFollowUp(
  status: string | null,
  nextActionDue: string | null,
  now = new Date(),
  timeZone = "Europe/London"
) {
  if (
    isDueToday(nextActionDue, timeZone, now) ||
    isOverdue(nextActionDue, timeZone, now)
  ) {
    return true;
  }
  return ["applied", "interviewing", "ready"].includes(status ?? "");
}

export function formatDateUk(value: string | null) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function formatUkDate(value: string | null) {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00Z`);
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed);
  }
  return formatDateUk(value);
}

export function formatDateTimeUk(value: string | null) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addBusinessDays(date: Date, days: number) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }
  return result;
}

function parseDateValue(value: string | null) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function toDateKey(value: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(value);
}
