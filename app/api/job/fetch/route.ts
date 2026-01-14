import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication, updateApplication } from "@/lib/data/applications";
import { createApplicationActivity } from "@/lib/data/application-activities";
import { cleanExtractedText, extractTextFromHtml } from "@/lib/job-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 10000;
const MAX_BYTES = 1.5 * 1024 * 1024;
const MIN_TEXT_CHARS = 800;
const MAX_TEXT_CHARS = 80000;

type FetchPayload = {
  applicationId?: string;
};

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as FetchPayload;
  const applicationId = body?.applicationId;

  if (!applicationId) {
    return NextResponse.json(
      { error: "Missing applicationId." },
      { status: 400 }
    );
  }

  const application = await fetchApplication(supabase, user.id, applicationId);

  if (!application) {
    return NextResponse.json(
      { error: "Application not found." },
      { status: 404 }
    );
  }

  const jobUrl = application.job_url?.trim();
  if (!jobUrl) {
    return NextResponse.json(
      { error: "Add a job advert link before fetching." },
      { status: 400 }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(jobUrl);
  } catch {
    return NextResponse.json(
      { error: "Job advert link is not a valid URL." },
      { status: 400 }
    );
  }

  if (!/^https?:$/.test(parsedUrl.protocol)) {
    return NextResponse.json(
      { error: "Only http:// or https:// links are allowed." },
      { status: 400 }
    );
  }

  const httpsCandidate =
    parsedUrl.protocol === "http:"
      ? new URL(`https://${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`)
      : parsedUrl;
  const fallbackUrl = parsedUrl.protocol === "http:" ? parsedUrl : null;

  const attemptFetch = async (url: URL) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "text/html, text/plain;q=0.9",
          "User-Agent": "CVForgeJobFetcher/1.0",
          ...(application.job_fetch_etag
            ? { "If-None-Match": application.job_fetch_etag }
            : {}),
          ...(application.job_fetch_last_modified
            ? { "If-Modified-Since": application.job_fetch_last_modified }
            : {}),
        },
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  };

  let response: Response | null = null;
  let usedUrl = httpsCandidate;

  try {
    response = await attemptFetch(httpsCandidate);
    if (!response.ok && fallbackUrl) {
      response = await attemptFetch(fallbackUrl);
      usedUrl = fallbackUrl;
    }
  } catch (error) {
    return handleFetchFailure(supabase, user.id, application.id, {
      message: "Unable to reach the job advert link.",
      sourceUrl: usedUrl.toString(),
      error,
    });
  }

  if (!response) {
    return handleFetchFailure(supabase, user.id, application.id, {
      message: "Unable to fetch the job advert link.",
      sourceUrl: usedUrl.toString(),
    });
  }

  if (response.status === 304) {
    await logFetchActivity(supabase, user.id, application.id, {
      status: "not_modified",
      urlHost: usedUrl.host,
      chars: application.job_text?.length ?? 0,
      truncated: false,
    });
    return NextResponse.json({
      ok: true,
      status: "not_modified",
      jobTextChars: application.job_text?.length ?? 0,
    });
  }

  if (!response.ok) {
    return handleFetchFailure(supabase, user.id, application.id, {
      message: `Fetch failed with status ${response.status}.`,
      sourceUrl: usedUrl.toString(),
    });
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isPlain = contentType.includes("text/plain");
  const isHtml =
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml+xml");

  if (!isPlain && !isHtml && contentType) {
    return handleFetchFailure(supabase, user.id, application.id, {
      message: "Unsupported content type for job advert.",
      sourceUrl: usedUrl.toString(),
      status: 400,
    });
  }

  const { text: rawText, truncated: truncatedBytes } = await readResponseText(
    response,
    MAX_BYTES
  );

  let extractedText = isPlain
    ? cleanExtractedText(rawText)
    : extractTextFromHtml(rawText);

  if (extractedText.length < MIN_TEXT_CHARS) {
    return handleFetchFailure(supabase, user.id, application.id, {
      message: "Fetched text was too short to use reliably.",
      sourceUrl: usedUrl.toString(),
      status: 400,
    });
  }

  let truncated = truncatedBytes;
  if (extractedText.length > MAX_TEXT_CHARS) {
    const note = "Note: Job advert truncated to 80,000 characters.\n\n";
    extractedText = `${note}${extractedText.slice(0, MAX_TEXT_CHARS - note.length)}`;
    truncated = true;
  }

  const hash = createHash("sha256").update(extractedText).digest("hex");
  const now = new Date().toISOString();

  await updateApplication(supabase, user.id, application.id, {
    job_text: extractedText,
    job_text_hash: hash,
    job_text_source: "fetched",
    job_fetched_at: now,
    job_fetch_status: "ok",
    job_fetch_error: null,
    job_fetch_etag: response.headers.get("etag"),
    job_fetch_last_modified: response.headers.get("last-modified"),
    job_source_url: usedUrl.toString(),
  });

  await logFetchActivity(supabase, user.id, application.id, {
    status: "ok",
    urlHost: usedUrl.host,
    chars: extractedText.length,
    truncated,
  });

  return NextResponse.json({
    ok: true,
    status: "ok",
    jobTextChars: extractedText.length,
    truncated,
  });
}

async function readResponseText(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    return { text: text.slice(0, maxBytes), truncated: text.length > maxBytes };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    if (total + value.length > maxBytes) {
      const remaining = maxBytes - total;
      if (remaining > 0) {
        chunks.push(value.slice(0, remaining));
      }
      total = maxBytes;
      truncated = true;
      break;
    }
    chunks.push(value);
    total += value.length;
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    buffer.set(chunk, offset);
    offset += chunk.length;
  });

  return { text: new TextDecoder("utf-8").decode(buffer), truncated };
}

async function logFetchActivity(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  applicationId: string,
  meta: { status: string; urlHost: string; chars: number; truncated: boolean }
) {
  try {
    await createApplicationActivity(supabase, userId, {
      application_id: applicationId,
      type: "job.fetch",
      channel: null,
      subject: "Job advert fetched",
      body: JSON.stringify(meta),
      occurred_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[job.fetch.activity]", error);
  }
}

async function handleFetchFailure(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  applicationId: string,
  params: { message: string; sourceUrl?: string; error?: unknown; status?: number }
) {
  const now = new Date().toISOString();
  try {
    await updateApplication(supabase, userId, applicationId, {
      job_fetch_status: "failed",
      job_fetch_error: params.message,
      job_fetched_at: now,
      job_source_url: params.sourceUrl ?? null,
    });
  } catch (error) {
    console.error("[job.fetch.update]", error);
  }

  await logFetchActivity(supabase, userId, applicationId, {
    status: "failed",
    urlHost: params.sourceUrl ? new URL(params.sourceUrl).host : "unknown",
    chars: 0,
    truncated: false,
  });

  if (params.error) {
    console.error("[job.fetch]", params.error);
  }

  return NextResponse.json(
    {
      error: params.message,
      detail: "Fetch failed.",
      hint: "Paste the job description manually if the site blocks automated fetching.",
    },
    { status: params.status ?? 502 }
  );
}
