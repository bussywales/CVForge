export type RoleFitSignal = {
  id: string;
  label: string;
  weight: number;
  aliases: string[];
  gapSuggestions: string[];
  metricSnippets: string[];
  packId: string;
  packLabel: string;
  source: "pack" | "fallback";
};

export type RoleFitSignalMatch = {
  id: string;
  label: string;
  weight: number;
  packId: string;
  packLabel: string;
  source: "pack" | "fallback";
};

export type RoleFitSignalGap = RoleFitSignalMatch & {
  actionSuggestions: string[];
  metricSuggestions: string[];
  primaryAction: string;
  shortAction: string;
  allowActions: boolean;
};

export type RoleFitResult = {
  score: number;
  matchedSignals: RoleFitSignalMatch[];
  gapSignals: RoleFitSignalGap[];
  matchedWeight: number;
  totalWeight: number;
  availableCount: number;
  matchedCount: number;
  coverage: number;
  coveragePct: number;
  appliedPacks: Array<{ id: string; label: string }>;
  fallbackUsed: boolean;
};

type RoleFitSignalDefinition = Omit<
  RoleFitSignal,
  "packId" | "packLabel" | "source"
>;

type RoleFitPack = {
  id: string;
  label: string;
  keywords: string[];
  signals: RoleFitSignalDefinition[];
};

const CORE_PACK: RoleFitPack = {
  id: "core",
  label: "Core",
  keywords: [],
  signals: [
    {
      id: "leadership-people-management",
      label: "Leadership & people management",
      weight: 8,
      aliases: [
        "leadership",
        "people management",
        "line management",
        "team lead",
        "managed team",
        "mentoring",
        "coaching",
        "performance management",
      ],
      gapSuggestions: [
        "Led a team, coaching and developing performance to deliver outcomes.",
        "Managed team capacity and capability planning to meet delivery targets.",
      ],
      metricSnippets: [
        "Improved team delivery by 25% and reduced attrition to under 5%.",
        "Raised engagement scores by 15 points while meeting delivery targets.",
        "Increased productivity by 20% through coaching and workload balancing.",
      ],
    },
    {
      id: "stakeholder-management",
      label: "Stakeholder management",
      weight: 7,
      aliases: [
        "stakeholder",
        "stakeholder management",
        "senior stakeholders",
        "executive",
        "business partner",
        "sponsor",
      ],
      gapSuggestions: [
        "Managed senior stakeholders, aligning priorities and securing decisions.",
        "Built stakeholder alignment across business and technical teams.",
      ],
      metricSnippets: [
        "Improved stakeholder satisfaction to 90%+ through regular updates.",
        "Reduced decision lead time by 30% via clear stakeholder cadence.",
        "Cut escalations by 40% through proactive stakeholder engagement.",
      ],
    },
    {
      id: "communication-reporting",
      label: "Communication & reporting",
      weight: 6,
      aliases: [
        "communication",
        "reporting",
        "status report",
        "briefing",
        "presentation",
        "dashboard",
      ],
      gapSuggestions: [
        "Produced concise status reporting and executive updates for delivery.",
        "Built reporting dashboards to track progress and risks.",
      ],
      metricSnippets: [
        "Reduced reporting cycle time by 40% with automated dashboards.",
        "Improved on-time reporting compliance to 98%.",
        "Cut reporting rework by 30% through clearer templates.",
      ],
    },
    {
      id: "project-delivery",
      label: "Project delivery",
      weight: 7,
      aliases: [
        "project delivery",
        "project management",
        "programme delivery",
        "milestone",
        "timeline",
        "schedule",
      ],
      gapSuggestions: [
        "Delivered projects to scope, budget, and timeline with clear milestones.",
        "Coordinated cross-functional delivery to meet programme milestones.",
      ],
      metricSnippets: [
        "Delivered 95% of milestones on time across a 12-month programme.",
        "Reduced delivery slippage by 30% through planning and tracking.",
        "Improved delivery predictability by 20% quarter-on-quarter.",
      ],
    },
    {
      id: "process-improvement",
      label: "Process improvement / continuous improvement",
      weight: 6,
      aliases: [
        "process improvement",
        "continuous improvement",
        "lean",
        "kaizen",
        "optimisation",
        "optimization",
        "streamlined",
        "automation",
      ],
      gapSuggestions: [
        "Streamlined processes to reduce waste and improve throughput.",
        "Delivered continuous improvement initiatives to increase quality and efficiency.",
      ],
      metricSnippets: [
        "Reduced process cycle time by 35% and improved throughput by 20%.",
        "Cut manual effort by 40% through process automation.",
        "Improved first-time quality by 25% after process changes.",
      ],
    },
    {
      id: "governance-compliance",
      label: "Governance / compliance / policy",
      weight: 6,
      aliases: [
        "governance",
        "compliance",
        "policy",
        "audit",
        "regulatory",
        "controls",
      ],
      gapSuggestions: [
        "Established governance and policy controls to meet compliance requirements.",
        "Implemented audit-ready processes and maintained compliance documentation.",
      ],
      metricSnippets: [
        "Achieved 100% audit compliance with zero high-risk findings.",
        "Reduced compliance gaps by 50% through policy adoption.",
        "Cut audit preparation time by 40% with standardised evidence packs.",
      ],
    },
    {
      id: "risk-management",
      label: "Risk management",
      weight: 6,
      aliases: [
        "risk management",
        "risk register",
        "mitigation",
        "risk assessment",
        "risk",
      ],
      gapSuggestions: [
        "Owned risk management, maintaining a risk register and mitigation plans.",
        "Identified and mitigated delivery risks through proactive controls.",
      ],
      metricSnippets: [
        "Reduced high-impact risks by 40% through mitigation planning.",
        "Cut unplanned risk impacts by 30% over two quarters.",
        "Improved risk closure rate to 90% within agreed timelines.",
      ],
    },
    {
      id: "change-management",
      label: "Change management",
      weight: 6,
      aliases: [
        "change management",
        "change",
        "adoption",
        "training",
        "communications plan",
      ],
      gapSuggestions: [
        "Delivered change management plans to drive adoption and reduce disruption.",
        "Coordinated training and comms to support change adoption.",
      ],
      metricSnippets: [
        "Achieved 85%+ adoption within 60 days of go-live.",
        "Reduced change-related issues by 25% via training and comms.",
        "Improved training completion to 98% across target users.",
      ],
    },
    {
      id: "service-delivery-operations",
      label: "Service delivery / operations",
      weight: 6,
      aliases: [
        "service delivery",
        "operations",
        "operational",
        "bau",
        "run service",
      ],
      gapSuggestions: [
        "Owned service delivery operations, ensuring stability and responsiveness.",
        "Improved operational processes to increase service reliability.",
      ],
      metricSnippets: [
        "Improved service availability to 99.9% and reduced incident volume by 20%.",
        "Reduced ticket backlog by 35% through operational tuning.",
        "Cut mean time to resolve by 30% for BAU incidents.",
      ],
    },
    {
      id: "kpi-metrics-ownership",
      label: "KPI / metrics ownership",
      weight: 7,
      aliases: [
        "kpi",
        "metrics",
        "performance",
        "okr",
        "sla",
        "service levels",
      ],
      gapSuggestions: [
        "Owned KPI reporting and used metrics to drive performance improvements.",
        "Defined and tracked KPIs to monitor delivery outcomes.",
      ],
      metricSnippets: [
        "Improved KPI attainment from 82% to 95% over two quarters.",
        "Met 97% SLA compliance across key services.",
        "Improved performance metrics by 20% through focused improvements.",
      ],
    },
    {
      id: "documentation-standards",
      label: "Documentation / standards",
      weight: 5,
      aliases: [
        "documentation",
        "standards",
        "procedures",
        "runbook",
        "playbook",
        "sop",
      ],
      gapSuggestions: [
        "Produced clear documentation and standards to improve consistency.",
        "Created runbooks and procedures to support operations.",
      ],
      metricSnippets: [
        "Reduced onboarding time by 30% with improved documentation.",
        "Cut operational errors by 25% through standardised procedures.",
        "Improved compliance to standards to 95% across teams.",
      ],
    },
  ],
};

const NETWORK_SECURITY_PACK: RoleFitPack = {
  id: "network_security",
  label: "Network/Security",
  keywords: [
    "siem",
    "firewall",
    "vulnerability",
    "patch",
    "cab",
    "itil",
    "zero trust",
    "segmentation",
    "vpn",
    "iam",
    "cloud",
  ],
  signals: [
    {
      id: "cab-change-control",
      label: "CAB / Change Control",
      weight: 10,
      aliases: [
        "cab",
        "change control",
        "itil",
        "rfc",
        "change advisory",
        "change advisory board",
      ],
      gapSuggestions: [
        "Led CAB change control, documenting risk, impact, and rollback for network changes.",
        "Improved RFC quality to reduce change-related incidents and failed implementations.",
      ],
      metricSnippets: [
        "Reduced change-related incidents by 30% through tighter CAB approvals.",
        "Cut failed changes by 25% and improved change approval SLA to 95%.",
        "Improved CAB throughput by 20% while maintaining risk controls.",
      ],
    },
    {
      id: "itil-service-management",
      label: "ITIL Service Management",
      weight: 6,
      aliases: [
        "itil",
        "incident",
        "problem",
        "change",
        "service management",
        "problem management",
      ],
      gapSuggestions: [
        "Applied ITIL practices across incident and change management to improve service stability.",
        "Standardised service management workflows and strengthened incident/problem processes.",
      ],
      metricSnippets: [
        "Reduced incident backlog by 35% and improved resolution SLA adherence to 96%.",
        "Improved problem management cycle time by 30% and lowered repeat incidents by 20%.",
        "Raised service KPI compliance to 98% across incident and change workflows.",
      ],
    },
    {
      id: "siem-detection-engineering",
      label: "SIEM / Detection Engineering",
      weight: 10,
      aliases: [
        "siem",
        "splunk",
        "sentinel",
        "qradar",
        "qrader",
        "use case",
        "rule tuning",
        "alert",
        "alerting",
      ],
      gapSuggestions: [
        "Built SIEM detections and tuned rules to reduce false positives and improve alert fidelity.",
        "Created new SIEM use cases to expand threat coverage and improve detection quality.",
      ],
      metricSnippets: [
        "Reduced false positives by 40% and cut alert triage time by 25%.",
        "Added 15 new detection use cases, improving threat coverage by 30%.",
        "Improved SIEM alert fidelity, increasing actionable alerts to 90%.",
      ],
    },
    {
      id: "incident-response",
      label: "Incident Response",
      weight: 7,
      aliases: [
        "incident response",
        "triage",
        "mttr",
        "containment",
        "post-incident",
        "post incident",
        "tabletop",
      ],
      gapSuggestions: [
        "Led incident response triage and containment to restore critical services faster.",
        "Ran post-incident reviews and improved playbooks to prevent repeat issues.",
      ],
      metricSnippets: [
        "Reduced MTTR by 35% and improved containment time to under 1 hour.",
        "Completed 6 tabletop exercises, improving response readiness by 20%.",
        "Lowered repeat incidents by 25% through post-incident reviews.",
      ],
    },
    {
      id: "vulnerability-management",
      label: "Vulnerability Management",
      weight: 9,
      aliases: [
        "vulnerability",
        "cve",
        "scan",
        "scanning",
        "qualys",
        "nessus",
        "tenable",
      ],
      gapSuggestions: [
        "Owned vulnerability scanning and triage, prioritising CVEs with clear remediation plans.",
        "Reduced critical exposure by driving vulnerability management across teams.",
      ],
      metricSnippets: [
        "Reduced critical vulnerabilities by 45% within 30 days of discovery.",
        "Improved scan coverage to 98% and cut CVE backlog by 40%.",
        "Cut critical exposure window from 45 to 20 days.",
      ],
    },
    {
      id: "patching-remediation-sla",
      label: "Patching / Remediation SLA",
      weight: 9,
      aliases: [
        "patch",
        "patching",
        "remediation",
        "sla",
        "time-to-remediate",
        "time to remediate",
        "critical findings",
      ],
      gapSuggestions: [
        "Managed patching cadence against remediation SLAs for critical vulnerabilities.",
        "Coordinated remediation to meet agreed SLAs and reduce time-to-remediate.",
      ],
      metricSnippets: [
        "Met 95% of critical patch SLAs and reduced overdue remediation by 60%.",
        "Reduced time-to-remediate critical findings from 30 to 10 days.",
        "Improved patch compliance to 97% across key platforms.",
      ],
    },
    {
      id: "zero-trust",
      label: "Zero Trust",
      weight: 8,
      aliases: ["zero trust", "zero-trust", "zta"],
      gapSuggestions: [
        "Delivered Zero Trust controls with least privilege and continuous verification.",
        "Implemented Zero Trust access patterns to tighten security without disrupting users.",
      ],
      metricSnippets: [
        "Reduced lateral movement risk by 40% through Zero Trust access policies.",
        "Cut privileged access exceptions by 30% with continuous verification.",
        "Improved Zero Trust policy compliance to 95%.",
      ],
    },
    {
      id: "network-segmentation",
      label: "Network Segmentation",
      weight: 8,
      aliases: [
        "segmentation",
        "microsegmentation",
        "micro-segmentation",
        "zones",
        "east-west",
        "east west",
      ],
      gapSuggestions: [
        "Designed network segmentation zones to limit east-west movement and reduce blast radius.",
        "Implemented microsegmentation to separate critical workloads and improve security posture.",
      ],
      metricSnippets: [
        "Reduced east-west traffic by 35% through segmentation of critical zones.",
        "Decreased lateral movement paths by 45% with microsegmentation.",
        "Improved segmentation policy compliance to 96%.",
      ],
    },
    {
      id: "firewall-policy-governance",
      label: "Firewall Policy Governance",
      weight: 8,
      aliases: [
        "firewall",
        "rulebase",
        "rule base",
        "policy governance",
        "rule review",
        "exceptions",
      ],
      gapSuggestions: [
        "Governed firewall rulebase changes, reviewing exceptions and removing unused rules.",
        "Implemented firewall policy reviews to tighten rules and reduce shadow access.",
      ],
      metricSnippets: [
        "Cut critical rule exceptions by 30% and reduced policy review cycle time by 40%.",
        "Reduced shadow rules by 25% and improved rule review SLA compliance to 95%.",
        "Removed 20% of unused rules while maintaining service uptime.",
      ],
    },
    {
      id: "vpn-remote-access",
      label: "VPN / Secure Remote Access",
      weight: 6,
      aliases: [
        "vpn",
        "remote access",
        "zscaler",
        "prisma",
        "conditional access",
        "ztna",
      ],
      gapSuggestions: [
        "Delivered secure remote access via VPN/ZTNA with conditional access policies.",
        "Hardened remote access controls to reduce unauthorised connections.",
      ],
      metricSnippets: [
        "Reduced unauthorised access attempts by 35% and improved remote access uptime to 99.9%.",
        "Cut VPN incident volume by 30% through policy tuning and access reviews.",
        "Improved secure remote access availability to 99.95%.",
      ],
    },
    {
      id: "cloud-connectivity",
      label: "Azure / AWS Connectivity & Networking",
      weight: 7,
      aliases: [
        "azure",
        "aws",
        "vpc",
        "vnet",
        "transit gateway",
        "expressroute",
        "express route",
        "direct connect",
        "directconnect",
      ],
      gapSuggestions: [
        "Built secure cloud connectivity (VPC/VNet, peering, ExpressRoute/Direct Connect).",
        "Implemented cloud networking for AWS/Azure workloads with secure routing.",
      ],
      metricSnippets: [
        "Reduced cloud connectivity latency by 25% via VNet/VPC optimisation.",
        "Improved cloud network uptime to 99.95% with resilient routing.",
        "Cut cloud networking change lead time by 30%.",
      ],
    },
    {
      id: "design-authority",
      label: "HLD / LLD / Design Authority",
      weight: 7,
      aliases: [
        "hld",
        "lld",
        "design authority",
        "tda",
        "architecture review",
        "design forum",
      ],
      gapSuggestions: [
        "Produced HLD/LLD designs and led architecture reviews for network changes.",
        "Presented designs at governance forums and secured design authority sign-off.",
      ],
      metricSnippets: [
        "Reduced design rework by 35% through HLD/LLD reviews and governance.",
        "Improved architecture approval turnaround by 25% with clearer designs.",
        "Lowered project delivery variance by 20% through stronger design authority.",
      ],
    },
  ],
};

const PROJECT_DELIVERY_PACK: RoleFitPack = {
  id: "project_delivery",
  label: "Project Delivery",
  keywords: [
    "project",
    "programme",
    "program",
    "agile",
    "scrum",
    "waterfall",
    "raci",
    "raid",
    "prince2",
    "prince 2",
    "gantt",
  ],
  signals: [
    {
      id: "agile-delivery",
      label: "Agile delivery (Scrum/Kanban)",
      weight: 8,
      aliases: [
        "agile",
        "scrum",
        "sprint",
        "backlog",
        "kanban",
        "user story",
      ],
      gapSuggestions: [
        "Ran agile delivery with sprint planning, backlog grooming, and retrospectives.",
        "Managed sprint cadence and delivery forecasting for agile teams.",
      ],
      metricSnippets: [
        "Improved sprint predictability to 90% and reduced carry-over by 25%.",
        "Increased team velocity by 20% over three sprints.",
        "Reduced blocked stories by 30% through better backlog grooming.",
      ],
    },
    {
      id: "waterfall-delivery",
      label: "Waterfall delivery",
      weight: 6,
      aliases: [
        "waterfall",
        "stage gate",
        "stage-gate",
        "gantt",
        "critical path",
      ],
      gapSuggestions: [
        "Delivered waterfall projects with stage gates and clear milestone control.",
        "Managed critical path and dependency tracking across a waterfall plan.",
      ],
      metricSnippets: [
        "Delivered 95% of stage gates on time across a waterfall programme.",
        "Reduced schedule variance by 20% through critical path management.",
        "Improved milestone adherence to 93% with tighter planning.",
      ],
    },
    {
      id: "raci-ownership",
      label: "RACI / ownership clarity",
      weight: 6,
      aliases: ["raci", "responsibility matrix", "ownership"],
      gapSuggestions: [
        "Defined RACI to clarify responsibilities and speed up decisions.",
        "Aligned teams on ownership using RACI and governance forums.",
      ],
      metricSnippets: [
        "Reduced decision delays by 30% after RACI adoption.",
        "Improved handover quality, cutting rework by 20%.",
        "Decreased ownership-related escalations by 25%.",
      ],
    },
    {
      id: "raid-management",
      label: "RAID / risks & issues",
      weight: 7,
      aliases: [
        "raid",
        "risk log",
        "issue log",
        "assumption log",
        "dependency log",
      ],
      gapSuggestions: [
        "Owned RAID logs and chaired regular risk/issue reviews.",
        "Tracked dependencies and resolved issues to keep delivery on track.",
      ],
      metricSnippets: [
        "Reduced critical risks by 40% through RAID governance.",
        "Cut open high-priority issues by 35% within one quarter.",
        "Improved dependency resolution time by 30%.",
      ],
    },
    {
      id: "prince2-governance",
      label: "PRINCE2 governance",
      weight: 6,
      aliases: ["prince2", "prince 2", "prince-2"],
      gapSuggestions: [
        "Delivered programmes using PRINCE2 governance and stage management.",
        "Applied PRINCE2 controls to manage scope and tolerances.",
      ],
      metricSnippets: [
        "Improved stage approval turnaround by 25% using PRINCE2 templates.",
        "Reduced scope creep by 30% through PRINCE2 controls.",
        "Cut governance rework by 20% with standard PRINCE2 artefacts.",
      ],
    },
    {
      id: "benefits-realisation",
      label: "Benefits realisation",
      weight: 6,
      aliases: [
        "business case",
        "benefits realisation",
        "benefits realization",
        "value case",
      ],
      gapSuggestions: [
        "Built business cases and tracked benefits realisation post-delivery.",
        "Defined benefits metrics and reported realised value against plan.",
      ],
      metricSnippets: [
        "Delivered 90% of planned benefits within six months of go-live.",
        "Improved benefits tracking coverage to 100% across key initiatives.",
        "Reduced benefits leakage by 25% through tighter tracking.",
      ],
    },
  ],
};

const PACKS = [CORE_PACK, NETWORK_SECURITY_PACK, PROJECT_DELIVERY_PACK];

const DETECTION_THRESHOLD = 3;
const MAX_DOMAIN_PACKS = 2;
const MIN_AVAILABLE_SIGNALS = 6;
const FALLBACK_LIMIT = 8;

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "than",
  "with",
  "within",
  "without",
  "for",
  "from",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "they",
  "them",
  "their",
  "we",
  "our",
  "you",
  "your",
  "i",
  "me",
  "my",
  "he",
  "she",
  "his",
  "her",
  "not",
  "no",
  "yes",
  "do",
  "does",
  "did",
  "done",
  "can",
  "could",
  "should",
  "would",
  "may",
  "might",
  "must",
  "will",
  "shall",
  "also",
  "other",
  "such",
  "using",
  "use",
  "used",
  "via",
  "per",
  "over",
  "under",
  "into",
  "across",
  "up",
  "down",
  "out",
  "about",
  "including",
  "include",
  "includes",
  "included",
  "role",
  "responsibilities",
  "requirements",
  "skills",
  "skill",
  "experience",
  "experienced",
  "knowledge",
  "ability",
  "abilities",
  "team",
  "teams",
  "work",
  "working",
  "develop",
  "development",
  "deliver",
  "delivery",
  "project",
  "projects",
  "support",
  "supporting",
  "manage",
  "management",
  "stakeholders",
  "stakeholder",
  "business",
  "systems",
  "service",
  "services",
  "looking",
  "seeking",
  "candidate",
  "ideal",
  "day",
  "days",
  "year",
  "years",
  "month",
  "months",
  "week",
  "weeks",
  "youll",
  "you'll",
  "we're",
  "youre",
  "weve",
  "we've",
  "our",
  "ours",
  "role",
  "job",
  "position",
  "duties",
]);

const FLUFF_WORDS = new Set([
  "innovative",
  "dynamic",
  "fast",
  "paced",
  "fastpaced",
  "exciting",
  "passionate",
  "motivated",
  "self",
  "starter",
  "proactive",
  "results",
  "driven",
  "team",
  "player",
  "high",
  "quality",
  "excellent",
  "strong",
  "great",
  "good",
  "outstanding",
  "flexible",
  "adaptable",
  "energised",
  "energetic",
  "ambitious",
]);

const FLUFF_PHRASES = ["fast paced", "team player", "self starter", "results driven"];

const ACRONYMS = new Set([
  "kpi",
  "sla",
  "okr",
  "cab",
  "itil",
  "siem",
  "mttr",
  "vpn",
  "raci",
  "raid",
  "prince2",
  "pmo",
  "uk",
  "aws",
  "azure",
]);

export function detectRoleFitPacks(jobDescription: string): RoleFitPack[] {
  const corpus = normalizeText(jobDescription);
  const scored = PACKS.filter((pack) => pack.id !== "core")
    .map((pack) => ({
      pack,
      score: scoreKeywords(corpus, pack.keywords),
    }))
    .filter((entry) => entry.score >= DETECTION_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_DOMAIN_PACKS)
    .map((entry) => entry.pack);

  return [CORE_PACK, ...scored];
}

export function calculateRoleFit(
  jobDescription: string,
  evidence: string
): RoleFitResult {
  const appliedPacks = detectRoleFitPacks(jobDescription);
  const evidenceCorpus = normalizeText(evidence);
  let availableSignals = buildSignalsForPacks(appliedPacks);

  let matchedSignals = availableSignals.filter((signal) =>
    matchesAnyAlias(evidenceCorpus, signal.aliases)
  );

  let fallbackUsed = false;

  if (
    matchedSignals.length === 0 ||
    availableSignals.length < MIN_AVAILABLE_SIGNALS
  ) {
    const fallbackSignals = extractFallbackSignals(
      jobDescription,
      availableSignals
    );
    if (fallbackSignals.length > 0) {
      fallbackUsed = true;
      availableSignals = [...availableSignals, ...fallbackSignals];
      matchedSignals = availableSignals.filter((signal) =>
        matchesAnyAlias(evidenceCorpus, signal.aliases)
      );
    }
  }

  const matchedWeight = sumWeights(matchedSignals);
  const totalWeight = sumWeights(availableSignals);
  const availableCount = availableSignals.length;
  const matchedCount = matchedSignals.length;
  const coverage = availableCount > 0 ? matchedCount / availableCount : 0;
  const coveragePct = Math.round(coverage * 100);

  let score =
    totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  score = clamp(score, 0, 100);
  if (coverage < 1 && score >= 100) {
    score = 99;
  }

  const matchedOutput = matchedSignals
    .slice()
    .sort(sortByWeight)
    .map(toMatch);

  const gapOutput = availableSignals
    .filter((signal) => !matchesAnyAlias(evidenceCorpus, signal.aliases))
    .slice()
    .sort(sortByWeight)
    .map(toGap);

  return {
    score,
    matchedSignals: matchedOutput,
    gapSignals: gapOutput,
    matchedWeight,
    totalWeight,
    availableCount,
    matchedCount,
    coverage,
    coveragePct,
    appliedPacks: appliedPacks.map((pack) => ({
      id: pack.id,
      label: pack.label,
    })),
    fallbackUsed,
  };
}

function buildSignalsForPacks(packs: RoleFitPack[]): RoleFitSignal[] {
  return packs.flatMap((pack) =>
    pack.signals.map((signal) => ({
      ...signal,
      packId: pack.id,
      packLabel: pack.label,
      source: "pack" as const,
    }))
  );
}

function extractFallbackSignals(
  jobDescription: string,
  existingSignals: RoleFitSignal[]
): RoleFitSignal[] {
  const corpus = normalizeText(jobDescription);
  if (!corpus) {
    return [];
  }

  const tokens = tokenize(corpus).filter(isMeaningfulToken);
  if (tokens.length < 2) {
    return [];
  }

  const existingAliases = new Set(
    existingSignals.flatMap((signal) =>
      signal.aliases.map((alias) => normalizeText(alias))
    )
  );

  const phraseCounts = new Map<string, number>();

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const bigram = `${tokens[index]} ${tokens[index + 1]}`;
    addPhrase(bigram, phraseCounts, existingAliases);

    if (index < tokens.length - 2) {
      const trigram = `${tokens[index]} ${tokens[index + 1]} ${tokens[index + 2]}`;
      addPhrase(trigram, phraseCounts, existingAliases);
    }
  }

  const sorted = Array.from(phraseCounts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0]);
    })
    .slice(0, FALLBACK_LIMIT);

  return sorted.map(([phrase, count]) => {
    const label = formatLabel(phrase);
    const actionSuggestions = makeFallbackActionSuggestions(label);
    const metricSnippets = makeFallbackMetricSnippets(label);
    return {
      id: `jd-${slugify(phrase)}`,
      label,
      weight: count >= 3 ? 2 : 1,
      aliases: [phrase],
      gapSuggestions: actionSuggestions,
      metricSnippets,
      packId: "fallback",
      packLabel: "JD terms",
      source: "fallback",
    };
  });
}

function addPhrase(
  phrase: string,
  phraseCounts: Map<string, number>,
  existingAliases: Set<string>
) {
  if (!phrase || phrase.length < 5) {
    return;
  }
  if (FLUFF_PHRASES.some((fluff) => phrase.includes(fluff))) {
    return;
  }
  if (existingAliases.has(phrase)) {
    return;
  }
  phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
}

function scoreKeywords(corpus: string, keywords: string[]) {
  if (!corpus || keywords.length === 0) {
    return 0;
  }
  return keywords.reduce(
    (total, keyword) => total + (matchesKeyword(corpus, keyword) ? 1 : 0),
    0
  );
}

function matchesAnyAlias(corpus: string, aliases: string[]): boolean {
  if (!corpus) {
    return false;
  }
  return aliases.some((alias) => matchesKeyword(corpus, alias));
}

function matchesKeyword(corpus: string, keyword: string): boolean {
  const normalisedKeyword = normalizeText(keyword);
  if (!normalisedKeyword) {
    return false;
  }
  if (
    normalisedKeyword.includes(" ") ||
    normalisedKeyword.includes("/") ||
    normalisedKeyword.includes("-")
  ) {
    return corpus.includes(normalisedKeyword);
  }
  const pattern = new RegExp(`\\b${escapeRegExp(normalisedKeyword)}\\b`, "i");
  return pattern.test(corpus);
}

function tokenize(text: string): string[] {
  return text.split(" ").filter(Boolean);
}

function isMeaningfulToken(token: string) {
  if (token.length < 3 || token.length > 30) {
    return false;
  }
  if (/^\d+$/.test(token)) {
    return false;
  }
  if (STOPWORDS.has(token)) {
    return false;
  }
  if (FLUFF_WORDS.has(token)) {
    return false;
  }
  return true;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9/\-\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sumWeights(signals: RoleFitSignal[]): number {
  return signals.reduce((total, signal) => total + signal.weight, 0);
}

function sortByWeight(a: RoleFitSignal, b: RoleFitSignal): number {
  if (b.weight !== a.weight) {
    return b.weight - a.weight;
  }
  return a.label.localeCompare(b.label);
}

function toMatch(signal: RoleFitSignal): RoleFitSignalMatch {
  return {
    id: signal.id,
    label: signal.label,
    weight: signal.weight,
    packId: signal.packId,
    packLabel: signal.packLabel,
    source: signal.source,
  };
}

function toGap(signal: RoleFitSignal): RoleFitSignalGap {
  const actionSuggestions = signal.gapSuggestions.slice(0, 2);
  const primaryAction = pickLonger(actionSuggestions);
  const shortAction = pickShorter(actionSuggestions);
  return {
    id: signal.id,
    label: signal.label,
    weight: signal.weight,
    packId: signal.packId,
    packLabel: signal.packLabel,
    source: signal.source,
    actionSuggestions,
    metricSuggestions: signal.metricSnippets.slice(0, 3),
    primaryAction,
    shortAction,
    allowActions: signal.source === "pack",
  };
}

function pickLonger(values: string[]): string {
  if (values.length === 0) {
    return "";
  }
  return values.reduce((longest, current) =>
    current.length > longest.length ? current : longest
  );
}

function pickShorter(values: string[]): string {
  if (values.length === 0) {
    return "";
  }
  return values.reduce((shortest, current) =>
    current.length < shortest.length ? current : shortest
  );
}

function formatLabel(phrase: string) {
  return phrase
    .split(" ")
    .map((word) => {
      if (ACRONYMS.has(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function slugify(value: string) {
  return value.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function makeFallbackActionSuggestions(label: string) {
  const lower = label.toLowerCase();
  return [
    `Delivered ${lower} improvements by coordinating stakeholders and tracking outcomes.`,
    `Improved ${lower} through clearer processes and regular reporting.`,
  ];
}

function makeFallbackMetricSnippets(label: string) {
  const lower = label.toLowerCase();
  return [
    clampText(`Improved ${lower} outcomes by 25% while meeting agreed SLAs.`),
    clampText(`Reduced ${lower} cycle time by 30% and improved KPI performance.`),
  ];
}

function clampText(value: string) {
  if (value.length <= 120) {
    return value;
  }
  return value.slice(0, 120).replace(/[.;:,]+$/g, "").trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
