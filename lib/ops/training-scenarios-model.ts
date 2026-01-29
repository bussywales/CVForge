export type TrainingScenario = {
  id: string;
  createdAt: string;
  createdBy: string;
  scenarioType: string;
  windowLabel: string;
  eventId: string | null;
  requestId: string | null;
  acknowledgedAt: string | null;
  ackRequestId: string | null;
  meta: Record<string, any>;
  isActive: boolean;
};

export function coerceTrainingScenario(input: any): TrainingScenario | null {
  if (!input || typeof input !== "object") return null;
  const id = typeof (input as any).id === "string" ? (input as any).id : "";
  if (!id) return null;
  return {
    id,
    createdAt: typeof (input as any).createdAt === "string" ? (input as any).createdAt : "",
    createdBy: typeof (input as any).createdBy === "string" ? (input as any).createdBy : "",
    scenarioType: typeof (input as any).scenarioType === "string" ? (input as any).scenarioType : "unknown",
    windowLabel: typeof (input as any).windowLabel === "string" ? (input as any).windowLabel : "15m",
    eventId: typeof (input as any).eventId === "string" ? (input as any).eventId : null,
    requestId: typeof (input as any).requestId === "string" ? (input as any).requestId : null,
    acknowledgedAt: typeof (input as any).acknowledgedAt === "string" ? (input as any).acknowledgedAt : null,
    ackRequestId: typeof (input as any).ackRequestId === "string" ? (input as any).ackRequestId : null,
    meta: (input as any).meta && typeof (input as any).meta === "object" ? (input as any).meta : {},
    isActive: typeof (input as any).isActive === "boolean" ? (input as any).isActive : true,
  };
}

export function coerceTrainingScenarios(input: any): TrainingScenario[] {
  if (!Array.isArray(input)) return [];
  return input.map(coerceTrainingScenario).filter(Boolean) as TrainingScenario[];
}
