import { z } from "zod";
import { sanitizeJsonStrings, sanitizeTextContent } from "@/lib/utils/autopack-sanitize";
import { coercePackOutputs, type PackOutputs } from "@/lib/packs/packs-model";

const JOB_DESCRIPTION_MAX = 12000;
const CV_TEXT_MAX = 12000;
const NOTES_MAX = 4000;

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return { value: text, truncated: false };
  return { value: text.slice(0, maxLength), truncated: true };
}

function parseJsonFromContent(content: string) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in response.");
  }
  return JSON.parse(content.slice(start, end + 1));
}

const packOutputSchema = z.object({
  cv: z
    .object({
      summary: z.string().optional(),
      sections: z
        .array(
          z.object({
            title: z.string(),
            bullets: z.array(z.string()),
          })
        )
        .optional(),
    })
    .optional(),
  coverLetter: z.string().optional(),
  starStories: z
    .array(
      z.object({
        title: z.string(),
        situation: z.string(),
        task: z.string(),
        action: z.string(),
        result: z.string(),
        relevance: z.string().optional(),
      })
    )
    .optional(),
  fitMap: z
    .array(
      z.object({
        requirement: z.string(),
        match: z.enum(["strong", "partial", "gap"]),
        evidence: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  rationale: z.string().optional(),
});

export function buildPackPrompt({
  jobDescription,
  cvText,
  notes,
  mode,
}: {
  jobDescription: string;
  cvText?: string | null;
  notes?: string | null;
  mode?: "standard" | "ats";
}) {
  return [
    {
      role: "system",
      content:
        "You are a senior career strategist. Return only JSON with keys: cv {summary, sections[{title, bullets[]}]} coverLetter, starStories[], fitMap[], rationale. Keep bullets concise, use evidence hints from CV/notes when available.",
    },
    {
      role: "user",
      content: [
        `Mode: ${mode ?? "standard"}`,
        "Job description:",
        jobDescription,
        cvText ? "Existing CV text:" : null,
        cvText ?? null,
        notes ? "User notes:" : null,
        notes ?? null,
        "Output JSON only. Fit map: requirements with match=strong|partial|gap and evidence hints. Provide 3-6 STAR stories.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export async function generatePackOutputs({
  jobDescription,
  cvText,
  notes,
  mode = "standard",
  now = new Date(),
}: {
  jobDescription: string;
  cvText?: string | null;
  notes?: string | null;
  mode?: "standard" | "ats";
  now?: Date;
}): Promise<{ outputs: PackOutputs; modelMeta: Record<string, any> }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OpenAI API key");
  }

  const jdTrimmed = sanitizeTextContent(jobDescription);
  const cvTrimmed = cvText ? sanitizeTextContent(cvText) : "";
  const notesTrimmed = notes ? sanitizeTextContent(notes) : "";
  const jd = truncateText(jdTrimmed, JOB_DESCRIPTION_MAX);
  const cv = truncateText(cvTrimmed, CV_TEXT_MAX);
  const note = truncateText(notesTrimmed, NOTES_MAX);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: buildPackPrompt({
        jobDescription: jd.value,
        cvText: cv.value || null,
        notes: note.value || null,
        mode,
      }),
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`);
  }

  const data = (await response.json()) as any;
  const content = data?.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonFromContent(content);
  const sanitized = sanitizeJsonStrings(parsed);
  const schemaParsed = packOutputSchema.safeParse(sanitized);
  const outputs = coercePackOutputs(schemaParsed.success ? schemaParsed.data : sanitized);

  return {
    outputs,
    modelMeta: {
      model: data?.model ?? "gpt-4o-mini",
      tokens: data?.usage ?? null,
      generatedAt: now.toISOString(),
      truncated: {
        jobDescription: jd.truncated,
        cvText: cv.truncated,
        notes: note.truncated,
      },
    },
  };
}
