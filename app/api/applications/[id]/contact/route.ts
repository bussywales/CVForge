import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication, updateApplication } from "@/lib/data/applications";
import { isValidEmail, isValidLinkedIn } from "@/lib/outreach-mailto";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const application = await fetchApplication(supabase, user.id, params.id);
  if (!application) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    contact: {
      name: application.contact_name,
      email: application.contact_email,
      linkedin_url: application.contact_linkedin,
    },
  });
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
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json().catch(() => ({}))) as unknown;
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const { name, email, linkedin_url } = parsed.data;

  if (email && !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }
  if (linkedin_url && !isValidLinkedIn(linkedin_url)) {
    return NextResponse.json({ ok: false, error: "Enter a valid LinkedIn URL." }, { status: 400 });
  }

  const existing = await fetchApplication(supabase, user.id, params.id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  await updateApplication(supabase, user.id, params.id, {
    contact_name: name ?? null,
    contact_email: email ?? null,
    contact_linkedin: linkedin_url ?? null,
  });

  return NextResponse.json({
    ok: true,
    contact: {
      name: name ?? null,
      email: email ?? null,
      linkedin_url: linkedin_url ?? null,
    },
  });
}
