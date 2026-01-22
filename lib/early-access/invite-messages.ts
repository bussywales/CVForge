const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.cvforge.com").replace(/\/$/, "");

type Channel = "email" | "whatsapp" | "sms" | "dm";

export function buildInviteMessage(channel: Channel, { firstName, inviteLink }: { firstName?: string | null; inviteLink: string }) {
  const namePart = firstName ? `${firstName}, ` : "";
  const body = `You're invited to CVForge early access. Use this link to sign up with your email: ${inviteLink}`;
  const extra = "Skip the waitlist and start with your first CV/application.";
  if (channel === "email") {
    return `${namePart}${body}\n\n${extra}\n\nIf the Early Access screen appears, click copy support snippet and send it back.`;
  }
  if (channel === "whatsapp") {
    return `${namePart}${body} — ${extra}`;
  }
  if (channel === "sms") {
    return `${namePart}${body}. ${extra}`;
  }
  return `${namePart}${body} (${extra})`;
}

export function defaultInviteLink() {
  return `${baseUrl}/signup`;
}
