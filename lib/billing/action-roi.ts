const ROI_MAP: Record<string, string> = {
  "autopack.generate": "Estimated time saved: ~20–30 minutes",
  "applicationKit.download": "Estimated time saved: ~10 minutes",
  "interviewPack.export": "Estimated time saved: ~10 minutes",
  "answerPack.generate": "Estimated time saved: ~5–10 minutes",
};

export function getActionRoiLine(actionKey: keyof typeof ROI_MAP) {
  return ROI_MAP[actionKey] ?? "Estimated time saved on this step.";
}
