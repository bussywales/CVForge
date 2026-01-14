const JUNK_PATTERNS = [
  /cookie/i,
  /consent/i,
  /preferences/i,
  /privacy policy/i,
  /accept all/i,
  /reject all/i,
  /manage cookies/i,
  /tracking/i,
  /analytics/i,
  /marketing/i,
];

const TAGS_TO_STRIP = [
  "script",
  "style",
  "noscript",
  "svg",
  "canvas",
  "nav",
  "footer",
  "header",
  "aside",
];

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export function extractTextFromHtml(html: string) {
  let text = html;
  TAGS_TO_STRIP.forEach((tag) => {
    const regex = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, "gi");
    text = text.replace(regex, " ");
  });

  text = text.replace(/<[^>]+>/g, " ");
  text = decodeEntities(text);
  return cleanExtractedText(text);
}

export function cleanExtractedText(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !JUNK_PATTERNS.some((pattern) => pattern.test(line)));

  const joined = lines.join("\n");
  return joined.replace(/\n{3,}/g, "\n\n").trim();
}

export function decodeEntities(input: string) {
  let text = input.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (match) => {
    return ENTITY_MAP[match] ?? match;
  });

  text = text.replace(/&#(x?[0-9a-fA-F]+);/g, (match, code) => {
    const value = code.startsWith("x")
      ? Number.parseInt(code.slice(1), 16)
      : Number.parseInt(code, 10);
    if (Number.isNaN(value)) {
      return match;
    }
    return String.fromCharCode(value);
  });

  return text;
}
