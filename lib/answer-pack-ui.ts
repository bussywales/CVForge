export type AnswerPackItem = {
  question: string;
  answer: string;
};

export function computeAnswerPackReadiness(items: AnswerPackItem[]) {
  const total = items.length;
  const readyCount = items.filter(
    (item) => Boolean(item.answer && item.answer.trim().length > 0)
  ).length;
  return { readyCount, total };
}

export function buildCopyAllText(
  items: AnswerPackItem[],
  options?: { includeEmpty?: boolean }
) {
  const includeEmpty = options?.includeEmpty ?? false;
  return items
    .filter((item) => includeEmpty || (item.answer && item.answer.trim()))
    .map((item, index) => {
      const title = item.question || `Question ${index + 1}`;
      const body = item.answer?.trim() ?? "";
      return `Q: ${title}\nA: ${body}`;
    })
    .join("\n\n");
}
