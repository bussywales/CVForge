import { NextResponse } from "next/server";
import { fetchApplication } from "@/lib/data/applications";
import { getSupabaseUser } from "@/lib/data/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get("applicationId");

  if (!applicationId) {
    return NextResponse.json(
      { error: "Missing applicationId." },
      { status: 400 }
    );
  }

  try {
    const application = await fetchApplication(supabase, user.id, applicationId);
    if (!application) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    if (!application.next_followup_at) {
      return NextResponse.json(
        { error: "No follow-up date set." },
        { status: 400 }
      );
    }

    const start = new Date(application.next_followup_at);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json(
        { error: "Invalid follow-up date." },
        { status: 400 }
      );
    }

    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const companyLabel = application.company_name ?? application.company;
    const summary = `Follow-up: ${application.job_title}${
      companyLabel ? ` (${companyLabel})` : ""
    }`;

    const ics = buildCalendarInvite({
      start,
      end,
      summary,
      description: "Follow up on your application.",
    });

    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "attachment; filename=followup.ics",
      },
    });
  } catch (error) {
    console.error("[calendar.followup]", error);
    return NextResponse.json(
      { error: "Unable to generate calendar invite." },
      { status: 500 }
    );
  }
}

type CalendarPayload = {
  start: Date;
  end: Date;
  summary: string;
  description: string;
};

function buildCalendarInvite({ start, end, summary, description }: CalendarPayload) {
  const uid = `${Date.now()}@cvforge`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CVForge//Follow-up//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsTimestamp(new Date())}`,
    `DTSTART:${toIcsTimestamp(start)}`,
    `DTEND:${toIcsTimestamp(end)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function toIcsTimestamp(date: Date) {
  const iso = date.toISOString().replace(/[-:]/g, "").split(".")[0];
  return `${iso}Z`;
}

function escapeIcs(value: string) {
  return value.replace(/\n/g, "\\n").replace(/,/g, "\\,");
}
