export type PackStatus = "draft" | "in_progress" | "ready" | "exported" | "applied" | "archived";

export type PackRecord = {
  id: string;
  userId: string;
  title: string;
  company: string | null;
  roleTitle: string | null;
  status: PackStatus;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  latestVersionId?: string | null;
  latestVersionCreatedAt?: string | null;
};

export type PackCvSection = {
  title: string;
  bullets: string[];
};

export type PackStarStory = {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  relevance?: string;
};

export type PackFitMapEntry = {
  requirement: string;
  match: "strong" | "partial" | "gap";
  evidence: string[];
  notes?: string;
};

export type PackOutputs = {
  cv: {
    summary: string;
    sections: PackCvSection[];
  };
  coverLetter: string;
  starStories: PackStarStory[];
  fitMap: PackFitMapEntry[];
  rationale: string;
};

export type PackVersionRecord = {
  id: string;
  packId: string;
  userId: string;
  jobDescription: string;
  inputsMasked: Record<string, any>;
  outputs: PackOutputs;
  modelMeta: Record<string, any> | null;
  createdAt: string;
};

const STATUS_VALUES: PackStatus[] = ["draft", "in_progress", "ready", "exported", "applied", "archived"];

export function coercePackStatus(value?: string | null): PackStatus {
  if (!value) return "draft";
  return STATUS_VALUES.includes(value as PackStatus) ? (value as PackStatus) : "draft";
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function coercePackOutputs(input: unknown): PackOutputs {
  const raw = typeof input === "object" && input ? (input as Record<string, any>) : {};
  const cvRaw = typeof raw.cv === "object" && raw.cv ? (raw.cv as Record<string, any>) : {};
  const sections = asArray<any>(cvRaw.sections).map((section) => {
    const sectionRaw = section && typeof section === "object" ? section : {};
    return {
      title: asString(sectionRaw.title),
      bullets: asArray<any>(sectionRaw.bullets).map((bullet) => asString(bullet)).filter(Boolean),
    };
  });

  const starStories = asArray<any>(raw.starStories).map((story) => {
    const storyRaw = story && typeof story === "object" ? story : {};
    return {
      title: asString(storyRaw.title),
      situation: asString(storyRaw.situation),
      task: asString(storyRaw.task),
      action: asString(storyRaw.action),
      result: asString(storyRaw.result),
      relevance: storyRaw.relevance ? asString(storyRaw.relevance) : undefined,
    };
  });

  const fitMap = asArray<any>(raw.fitMap).map((entry) => {
    const entryRaw = entry && typeof entry === "object" ? entry : {};
    const matchRaw = asString(entryRaw.match, "gap");
    const match: PackFitMapEntry["match"] = matchRaw === "strong" || matchRaw === "partial" ? matchRaw : "gap";
    return {
      requirement: asString(entryRaw.requirement),
      match,
      evidence: asArray<any>(entryRaw.evidence).map((item) => asString(item)).filter(Boolean),
      notes: entryRaw.notes ? asString(entryRaw.notes) : undefined,
    };
  });

  return {
    cv: {
      summary: asString(cvRaw.summary),
      sections,
    },
    coverLetter: asString(raw.coverLetter),
    starStories,
    fitMap,
    rationale: asString(raw.rationale),
  };
}

export function coercePackRecord(input: any): PackRecord {
  return {
    id: asString(input?.id),
    userId: asString(input?.user_id ?? input?.userId),
    title: asString(input?.title),
    company: input?.company ?? null,
    roleTitle: input?.role_title ?? input?.roleTitle ?? null,
    status: coercePackStatus(input?.status),
    source: input?.source ?? null,
    createdAt: asString(input?.created_at ?? input?.createdAt),
    updatedAt: asString(input?.updated_at ?? input?.updatedAt),
    latestVersionId: input?.latestVersionId ?? input?.latest_version_id ?? null,
    latestVersionCreatedAt: input?.latestVersionCreatedAt ?? input?.latest_version_created_at ?? null,
  };
}

export function coercePackVersionRecord(input: any): PackVersionRecord {
  return {
    id: asString(input?.id),
    packId: asString(input?.pack_id ?? input?.packId),
    userId: asString(input?.user_id ?? input?.userId),
    jobDescription: asString(input?.job_description ?? input?.jobDescription),
    inputsMasked:
      (input?.inputs_masked ?? input?.inputsMasked) && typeof (input?.inputs_masked ?? input?.inputsMasked) === "object"
        ? (input?.inputs_masked ?? input?.inputsMasked)
        : {},
    outputs: coercePackOutputs(input?.outputs),
    modelMeta:
      input?.model_meta && typeof input?.model_meta === "object"
        ? input?.model_meta
        : input?.modelMeta && typeof input?.modelMeta === "object"
          ? input?.modelMeta
          : null,
    createdAt: asString(input?.created_at ?? input?.createdAt),
  };
}
