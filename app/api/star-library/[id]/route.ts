import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { fetchStarLibraryById, updateStarLibrary } from "@/lib/data/star-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  title: z.string().max(120).optional(),
  situation: z.string().max(2000).optional(),
  task: z.string().max(2000).optional(),
  action: z.string().max(4000).optional(),
  result: z.string().max(2000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const draft = await fetchStarLibraryById(supabase, user.id, params.id);
    if (!draft) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }

    const updated = await updateStarLibrary(supabase, user.id, draft.id, {
      title: parsed.data.title ?? draft.title,
      situation: parsed.data.situation ?? draft.situation,
      task: parsed.data.task ?? draft.task,
      action: parsed.data.action ?? draft.action,
      result: parsed.data.result ?? draft.result,
    });

    return NextResponse.json({ draft: updated });
  } catch (error) {
    console.error("[star-library.update]", error);
    return NextResponse.json(
      { error: "Unable to update the STAR draft right now." },
      { status: 500 }
    );
  }
}
