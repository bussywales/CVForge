import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseUser } from "@/lib/data/supabase";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  proposalId: z.string().uuid(),
});

export async function POST(request: Request) {
  const { user } = await getSupabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const service = createServiceRoleClient();
    const { data: proposal, error } = await service
      .from("domain_pack_proposals")
      .select(
        "id, domain_guess, title, signals, source_terms, occurrences, status"
      )
      .eq("id", parsed.data.proposalId)
      .maybeSingle();

    if (error) {
      console.error("[admin.publish.fetch]", error);
      return NextResponse.json(
        { error: "Unable to load proposal." },
        { status: 500 }
      );
    }

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found." },
        { status: 404 }
      );
    }

    if (proposal.status !== "pending") {
      return NextResponse.json(
        { error: "Proposal is not pending." },
        { status: 400 }
      );
    }

    const slug = slugify(proposal.domain_guess || proposal.title || "");
    if (!slug) {
      return NextResponse.json(
        { error: "Unable to derive a pack slug." },
        { status: 400 }
      );
    }

    const title = cleanTitle(proposal.title || proposal.domain_guess || slug);
    const packPayload = {
      title,
      domainGuess: proposal.domain_guess,
      keywords: Array.isArray(proposal.source_terms)
        ? proposal.source_terms.slice(0, 12)
        : [],
      signals: proposal.signals,
    };

    const { data: existing, error: existingError } = await service
      .from("domain_packs")
      .select("id, version")
      .eq("slug", slug)
      .maybeSingle();

    if (existingError) {
      console.error("[admin.publish.lookup]", existingError);
      return NextResponse.json(
        { error: "Unable to check existing packs." },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();
    let version = 1;

    if (existing) {
      version = (existing.version ?? 1) + 1;
      const { error: updateError } = await service
        .from("domain_packs")
        .update({
          title,
          version,
          pack: packPayload,
          updated_at: now,
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("[admin.publish.update]", updateError);
        return NextResponse.json(
          { error: "Unable to publish the pack." },
          { status: 500 }
        );
      }
    } else {
      const { error: insertError } = await service.from("domain_packs").insert({
        slug,
        title,
        version,
        is_active: true,
        pack: packPayload,
        created_at: now,
        updated_at: now,
      });

      if (insertError) {
        console.error("[admin.publish.insert]", insertError);
        return NextResponse.json(
          { error: "Unable to publish the pack." },
          { status: 500 }
        );
      }
    }

    const { error: proposalError } = await service
      .from("domain_pack_proposals")
      .update({ status: "approved", updated_at: now })
      .eq("id", proposal.id);

    if (proposalError) {
      console.error("[admin.publish.proposal]", proposalError);
      return NextResponse.json(
        { error: "Pack published but proposal status failed to update." },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "approved", slug, version });
  } catch (error) {
    console.error("[admin.publish]", error);
    return NextResponse.json(
      { error: "Unable to publish the pack." },
      { status: 500 }
    );
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cleanTitle(value: string) {
  const trimmed = value.replace(/\s*\(draft\)\s*$/i, "").trim();
  return trimmed || "Untitled pack";
}
