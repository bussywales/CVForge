import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication, updateApplication } from "@/lib/data/applications";
import { isValidEmail, isValidLinkedIn } from "@/lib/outreach-mailto";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { headers, requestId } = withRequestIdHeaders();
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });

  const application = await fetchApplication(supabase, user.id, params.id);
  if (!application) {
    return jsonError({ code: "NOT_FOUND", message: "Not found", requestId, status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      contact: {
        name: application.contact_name,
        email: application.contact_email,
        linkedin_url: application.contact_linkedin,
      },
    },
    { headers }
  );
}

const bodySchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  linkedin_url: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });

  const payload = (await request.json().catch(() => ({}))) as unknown;
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError({ code: "INVALID_PAYLOAD", message: "Invalid payload", requestId, status: 400 });
  }

  const { name, email, linkedin_url } = parsed.data;

  if (email && !isValidEmail(email)) {
    return jsonError({ code: "INVALID_EMAIL", message: "INVALID_EMAIL", requestId, status: 400 });
  }
  if (linkedin_url && !isValidLinkedIn(linkedin_url)) {
    return jsonError({ code: "INVALID_LINKEDIN_URL", message: "INVALID_LINKEDIN_URL", requestId, status: 400 });
  }

  const existing = await fetchApplication(supabase, user.id, params.id);
  if (!existing) {
    return jsonError({ code: "NOT_FOUND", message: "Not found", requestId, status: 404 });
  }

  try {
    await updateApplication(supabase, user.id, params.id, {
      contact_name: name ?? null,
      contact_email: email ?? null,
      contact_linkedin: linkedin_url ?? null,
    });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/applications/[id]/contact", userId: user.id, code: "CONTACT_SAVE_FAIL" });
    return jsonError({ code: "CONTACT_SAVE_FAIL", message: "Unable to save contact", requestId });
  }

  return NextResponse.json(
    {
      ok: true,
      contact: {
        name: name ?? null,
        email: email ?? null,
        linkedin_url: linkedin_url ?? null,
      },
    },
    { headers }
  );
}
