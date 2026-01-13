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

    const nextActionDue = application.next_action_due?.trim();
    const nextFollowupAt = application.next_followup_at;

    const companyLabel = application.company_name ?? application.company;
    const summary = `Follow-up: ${application.job_title}${
      companyLabel ? ` (${companyLabel})` : ""
    }`;

    let ics = "";

    if (nextActionDue) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextActionDue)) {
        return NextResponse.json(
          { error: "Invalid next action date." },
          { status: 400 }
        );
      }
      const dateKey = nextActionDue.replace(/-/g, "");
      ics = buildCalendarInvite({
        summary,
        description: "Follow up on your application.",
        timeZone: "Europe/London",
        startLocal: `${dateKey}T090000`,
        endLocal: `${dateKey}T093000`,
      });
    } else {
      if (!nextFollowupAt) {
        return NextResponse.json(
          { error: "No follow-up date set." },
          { status: 400 }
        );
      }

      const start = new Date(nextFollowupAt);
      if (Number.isNaN(start.getTime())) {
        return NextResponse.json(
          { error: "Invalid follow-up date." },
          { status: 400 }
        );
      }
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      ics = buildCalendarInvite({
        start,
        end,
        summary,
        description: "Follow up on your application.",
      });
    }

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

type CalendarPayload =
  | {
      start: Date;
      end: Date;
      summary: string;
      description: string;
    }
  | {
      startLocal: string;
      endLocal: string;
      timeZone: string;
      summary: string;
      description: string;
    };

function buildCalendarInvite(payload: CalendarPayload) {
  const uid = `${Date.now()}@cvforge`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CVForge//Follow-up//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsTimestamp(new Date())}`,
  ];

  if ("startLocal" in payload) {
    lines.push(
      `DTSTART;TZID=${payload.timeZone}:${payload.startLocal}`,
      `DTEND;TZID=${payload.timeZone}:${payload.endLocal}`
    );
  } else {
    lines.push(
      `DTSTART:${toIcsTimestamp(payload.start)}`,
      `DTEND:${toIcsTimestamp(payload.end)}`
    );
  }

  lines.push(
    `SUMMARY:${escapeIcs(payload.summary)}`,
    `DESCRIPTION:${escapeIcs(payload.description)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  );

  return lines.join("\r\n");
}

function toIcsTimestamp(date: Date) {
  const iso = date.toISOString().replace(/[-:]/g, "").split(".")[0];
  return `${iso}Z`;
}

function escapeIcs(value: string) {
  return value.replace(/\n/g, "\\n").replace(/,/g, "\\,");
}
