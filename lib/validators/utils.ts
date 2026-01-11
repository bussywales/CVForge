import type { ZodError } from "zod";

export function getFieldErrors(error: ZodError): Record<string, string> {
  const { fieldErrors } = error.flatten();
  const entries = (Object.entries(fieldErrors) as Array<
    [string, string[] | undefined]
  >).flatMap(([key, messages]) => {
    if (!messages || messages.length === 0) {
      return [];
    }
    return [[key, messages[0]] as const];
  });

  return Object.fromEntries(entries);
}
