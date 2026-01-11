export function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

export function toNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
