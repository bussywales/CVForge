export function buildInviteInstructions(baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.cvforge.com") {
  const steps = [
    `1) Go to ${baseUrl}/signup`,
    "2) Sign up using this email (same as the invite)",
    "3) If you still see the Early Access screen, copy the support snippet and send it back to us.",
  ];
  return `Early access invite\n${steps.join("\n")}`;
}
