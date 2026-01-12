export type RoleFitSignal = {
  id: string;
  label: string;
  keywords: string[];
  weight: number;
  suggestions: string[];
  category?: string;
};

export type RoleFitSignalMatch = {
  id: string;
  label: string;
  weight: number;
};

export type RoleFitSignalGap = RoleFitSignalMatch & {
  suggestions: string[];
};

export type RoleFitResult = {
  score: number;
  matchedSignals: RoleFitSignalMatch[];
  gapSignals: RoleFitSignalGap[];
  matchedWeight: number;
  totalWeight: number;
  relevantCount: number;
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
      "Led CAB change control, documenting risk and securing approvals for network changes.",
      "Improved RFC quality to reduce change-related incidents and failed implementations.",
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
    };
  }

  const matchedSignals = relevantSignals.filter((signal) =>
    matchesAnyKeyword(evidenceCorpus, signal.keywords)
  );
  const gapSignals = relevantSignals.filter(
    (signal) => !matchesAnyKeyword(evidenceCorpus, signal.keywords)
  );

  const matchedWeight = sumWeights(matchedSignals);
  const score = clamp(Math.round((matchedWeight / totalWeight) * 100), 0, 100);

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
  return {
    id: signal.id,
    label: signal.label,
    weight: signal.weight,
    suggestions: signal.suggestions.slice(0, 2),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
