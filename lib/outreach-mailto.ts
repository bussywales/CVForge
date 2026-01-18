export function buildMailto({
  email,
  subject,
  body,
}: {
  email: string;
  subject: string;
  body: string;
}) {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`;
}

export function isValidEmail(value?: string | null) {
  if (!value) return false;
  const email = value.trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export function isValidLinkedIn(value?: string | null) {
  if (!value) return false;
  const url = value.trim();
  if (!/^https?:/i.test(url)) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
