export type RoleFitSignal = {
  id: string;
  label: string;
  keywords: string[];
  weight: number;
  suggestions: string[];
  metricSuggestions: string[];
  category?: string;
};

export type RoleFitSignalMatch = {
  id: string;
  label: string;
  weight: number;
};

export type RoleFitSignalGap = RoleFitSignalMatch & {
  actionSuggestions: string[];
  metricSuggestions: string[];
  primaryAction: string;
  shortAction: string;
};

export type RoleFitResult = {
  score: number;
  matchedSignals: RoleFitSignalMatch[];
  gapSignals: RoleFitSignalGap[];
  matchedWeight: number;
  totalWeight: number;
  relevantCount: number;
  coverage: number;
};

const ROLE_FIT_SIGNALS: RoleFitSignal[] = [
  {
    id: "cab-change-control",
    label: "CAB / Change Control",
    keywords: [
      "cab",
      "change control",
      "itil",
      "rfc",
      "change advisory",
      "change advisory board",
    ],
    weight: 10,
    suggestions: [
      "Led CAB change control, documenting risk, impact, and rollback for network changes.",
      "Improved RFC quality to reduce change-related incidents and failed implementations.",
    ],
    metricSuggestions: [
      "Reduced change-related incidents by 30% through tighter CAB approvals and impact reviews.",
      "Cut failed changes by 25% and improved change approval SLA to 95%.",
      "Improved CAB throughput by 20% while maintaining risk controls.",
    ],
  },
  {
    id: "itil-service-management",
    label: "ITIL Service Management",
    keywords: [
      "itil",
      "incident",
      "problem",
      "change",
      "service management",
      "problem management",
    ],
    weight: 6,
    suggestions: [
      "Applied ITIL practices across incident and change management to improve service stability.",
      "Standardised service management workflows and strengthened incident/problem processes.",
    ],
    metricSuggestions: [
      "Reduced incident backlog by 35% and improved resolution SLA adherence to 96%.",
      "Improved problem management cycle time by 30% and lowered repeat incidents by 20%.",
      "Raised service KPI compliance to 98% across incident and change workflows.",
    ],
  },
  {
    id: "siem-detection-engineering",
    label: "SIEM / Detection Engineering",
    keywords: [
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
    weight: 10,
    suggestions: [
      "Built SIEM detections and tuned rules to reduce false positives and improve alert fidelity.",
      "Created new SIEM use cases to expand threat coverage and improve detection quality.",
    ],
    metricSuggestions: [
      "Reduced false positives by 40% and cut alert triage time by 25%.",
      "Added 15 new detection use cases, improving threat coverage by 30%.",
      "Improved SIEM alert fidelity, increasing actionable alerts to 90%.",
    ],
  },
  {
    id: "incident-response",
    label: "Incident Response",
    keywords: [
      "incident response",
      "triage",
      "mttr",
      "containment",
      "post-incident",
      "post incident",
      "tabletop",
    ],
    weight: 7,
    suggestions: [
      "Led incident response triage and containment to restore critical services faster.",
      "Ran post-incident reviews and improved playbooks to prevent repeat issues.",
    ],
    metricSuggestions: [
      "Reduced MTTR by 35% and improved containment time to under 1 hour.",
      "Completed 6 tabletop exercises, improving response readiness scores by 20%.",
      "Lowered repeat incidents by 25% through post-incident reviews.",
    ],
  },
  {
    id: "vulnerability-management",
    label: "Vulnerability Management",
    keywords: [
      "vulnerability",
      "cve",
      "scan",
      "scanning",
      "qualys",
      "nessus",
      "tenable",
    ],
    weight: 9,
    suggestions: [
      "Owned vulnerability scanning and triage, prioritising CVEs with clear remediation plans.",
      "Reduced critical exposure by driving vulnerability management across teams.",
    ],
    metricSuggestions: [
      "Reduced critical vulnerabilities by 45% within 30 days of discovery.",
      "Improved scan coverage to 98% and cut CVE backlog by 40%.",
      "Cut critical exposure window from 45 to 20 days.",
    ],
  },
  {
    id: "patching-remediation-sla",
    label: "Patching / Remediation SLA",
    keywords: [
      "patch",
      "patching",
      "remediation",
      "sla",
      "time-to-remediate",
      "time to remediate",
      "critical findings",
    ],
    weight: 9,
    suggestions: [
      "Managed patching cadence against remediation SLAs for critical vulnerabilities.",
      "Coordinated remediation to meet agreed SLAs and reduce time-to-remediate.",
    ],
    metricSuggestions: [
      "Met 95% of critical patch SLAs and reduced overdue remediation by 60%.",
      "Reduced time-to-remediate critical findings from 30 to 10 days.",
      "Improved patch compliance to 97% across key platforms.",
    ],
  },
  {
    id: "zero-trust",
    label: "Zero Trust",
    keywords: ["zero trust", "zero-trust", "zta"],
    weight: 8,
    suggestions: [
      "Delivered Zero Trust controls with least privilege and continuous verification.",
      "Implemented Zero Trust access patterns to tighten security without disrupting users.",
    ],
    metricSuggestions: [
      "Reduced lateral movement risk by 40% through Zero Trust access policies.",
      "Cut privileged access exceptions by 30% with continuous verification.",
      "Improved Zero Trust policy compliance to 95%.",
    ],
  },
  {
    id: "network-segmentation",
    label: "Network Segmentation",
    keywords: [
      "segmentation",
      "microsegmentation",
      "micro-segmentation",
      "zones",
      "east-west",
      "east west",
    ],
    weight: 8,
    suggestions: [
      "Designed network segmentation zones to limit east-west movement and reduce blast radius.",
      "Implemented microsegmentation to separate critical workloads and improve security posture.",
    ],
    metricSuggestions: [
      "Reduced east-west traffic by 35% through segmentation of critical zones.",
      "Decreased lateral movement paths by 45% with microsegmentation.",
      "Improved segmentation policy compliance to 96%.",
    ],
  },
  {
    id: "firewall-policy-governance",
    label: "Firewall Policy Governance",
    keywords: [
      "firewall",
      "rulebase",
      "rule base",
      "policy governance",
      "rule review",
      "exceptions",
    ],
    weight: 8,
    suggestions: [
      "Governed firewall rulebase changes, reviewing exceptions and removing unused rules.",
      "Implemented firewall policy reviews to tighten rules and reduce shadow access.",
    ],
    metricSuggestions: [
      "Cut critical rule exceptions by 30% and reduced policy review cycle time by 40%.",
      "Reduced shadow rules by 25% and improved rule review SLA compliance to 95%.",
      "Removed 20% of unused rules while maintaining service uptime.",
    ],
  },
  {
    id: "vpn-remote-access",
    label: "VPN / Secure Remote Access",
    keywords: [
      "vpn",
      "remote access",
      "zscaler",
      "prisma",
      "conditional access",
      "ztna",
    ],
    weight: 6,
    suggestions: [
      "Delivered secure remote access via VPN/ZTNA with conditional access policies.",
      "Hardened remote access controls to reduce unauthorised connections.",
    ],
    metricSuggestions: [
      "Reduced unauthorised access attempts by 35% and improved remote access uptime to 99.9%.",
      "Cut VPN incident volume by 30% through policy tuning and access reviews.",
      "Improved secure remote access availability to 99.95%.",
    ],
  },
  {
    id: "cloud-connectivity",
    label: "Azure / AWS Connectivity & Networking",
    keywords: [
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
    weight: 7,
    suggestions: [
      "Built secure cloud connectivity (VPC/VNet, peering, ExpressRoute/Direct Connect).",
      "Implemented cloud networking for AWS/Azure workloads with secure routing.",
    ],
    metricSuggestions: [
      "Reduced cloud connectivity latency by 25% via VNet/VPC optimisation.",
      "Improved cloud network uptime to 99.95% with resilient routing.",
      "Cut cloud networking change lead time by 30%.",
    ],
  },
  {
    id: "design-authority",
    label: "HLD / LLD / Design Authority",
    keywords: [
      "hld",
      "lld",
      "design authority",
      "tda",
      "architecture review",
      "design forum",
    ],
    weight: 7,
    suggestions: [
      "Produced HLD/LLD designs and led architecture reviews for network changes.",
      "Presented designs at governance forums and secured design authority sign-off.",
    ],
    metricSuggestions: [
      "Reduced design rework by 35% through HLD/LLD reviews and governance.",
      "Improved architecture approval turnaround by 25% with clearer designs.",
      "Lowered project delivery variance by 20% through stronger design authority.",
    ],
  },
];

const MAX_GAPS = 6;
const MAX_MATCHED = 10;

export function calculateRoleFit(
  jobDescription: string,
  evidence: string
): RoleFitResult {
  const jdCorpus = normalizeText(jobDescription);
  const evidenceCorpus = normalizeText(evidence);

  const relevantSignals = ROLE_FIT_SIGNALS.filter((signal) =>
    matchesAnyKeyword(jdCorpus, signal.keywords)
  );
  const totalWeight = sumWeights(relevantSignals);

  if (totalWeight === 0) {
    return {
      score: 0,
      matchedSignals: [],
      gapSignals: [],
      matchedWeight: 0,
      totalWeight: 0,
      relevantCount: 0,
      coverage: 0,
    };
  }

  const matchedSignals = relevantSignals.filter((signal) =>
    matchesAnyKeyword(evidenceCorpus, signal.keywords)
  );
  const gapSignals = relevantSignals.filter(
    (signal) => !matchesAnyKeyword(evidenceCorpus, signal.keywords)
  );

  const matchedWeight = sumWeights(matchedSignals);
  const coverage = matchedSignals.length / relevantSignals.length;
  let score = clamp(Math.round((matchedWeight / totalWeight) * 100), 0, 100);
  if (coverage < 1 && score >= 100) {
    score = 99;
  }

  const matchedOutput = matchedSignals
    .slice()
    .sort(sortByWeight)
    .slice(0, MAX_MATCHED)
    .map(toMatch);

  const gapOutput = gapSignals
    .slice()
    .sort(sortByWeight)
    .slice(0, MAX_GAPS)
    .map(toGap);

  return {
    score,
    matchedSignals: matchedOutput,
    gapSignals: gapOutput,
    matchedWeight,
    totalWeight,
    relevantCount: relevantSignals.length,
    coverage,
  };
}

function matchesAnyKeyword(corpus: string, keywords: string[]): boolean {
  if (!corpus) {
    return false;
  }
  return keywords.some((keyword) => matchesKeyword(corpus, keyword));
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
  };
}

function toGap(signal: RoleFitSignal): RoleFitSignalGap {
  const actionSuggestions = signal.suggestions.slice(0, 2);
  const primaryAction = pickLonger(actionSuggestions);
  const shortAction = pickShorter(actionSuggestions);
  return {
    id: signal.id,
    label: signal.label,
    weight: signal.weight,
    actionSuggestions,
    metricSuggestions: signal.metricSuggestions.slice(0, 3),
    primaryAction,
    shortAction,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
