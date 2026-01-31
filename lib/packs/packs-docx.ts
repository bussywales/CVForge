import type { Document as DocxDocument, Paragraph as DocxParagraph } from "docx";
import { createRequire } from "module";
import type { ExportVariant } from "@/lib/export/export-utils";
import { sanitizeTextContent } from "@/lib/utils/autopack-sanitize";
import type { PackOutputs } from "@/lib/packs/packs-model";

type DocxModule = typeof import("docx");

const require = createRequire(import.meta.url);
let docxModule: DocxModule | null = null;

function getDocxModule() {
  if (!docxModule) {
    docxModule = require("docx") as DocxModule;
  }
  return docxModule;
}

type HeadingValue =
  | "Heading1"
  | "Heading2"
  | "Title"
  | "Heading3"
  | "Heading4"
  | "Heading5"
  | "Heading6";

function resolveHeadingLevels() {
  const docx = getDocxModule();
  const heading = (docx as unknown as { HeadingLevel?: Record<string, string> }).HeadingLevel;
  const titleHeading = (heading?.TITLE ?? heading?.HEADING_1 ?? "Heading1") as HeadingValue;
  const sectionHeading = (heading?.HEADING_2 ?? heading?.HEADING_1 ?? "Heading2") as HeadingValue;
  return { titleHeading, sectionHeading };
}

function getSpacing(variant: ExportVariant) {
  if (variant === "ats_minimal") {
    return { after: 80, line: 240 };
  }
  return { after: 120, line: 280 };
}

function splitParagraphs(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .reduce<string[]>((acc, line) => {
      if (!line) {
        acc.push("");
        return acc;
      }
      if (!acc.length || acc[acc.length - 1] === "") {
        acc.push(line);
      } else {
        acc[acc.length - 1] = `${acc[acc.length - 1]} ${line}`;
      }
      return acc;
    }, [])
    .filter(Boolean);
}

export function buildPackDocx({
  title,
  outputs,
  variant = "standard",
}: {
  title: string;
  outputs: PackOutputs;
  variant?: ExportVariant;
}): DocxDocument {
  const { Document, Paragraph, TextRun } = getDocxModule();
  const { titleHeading, sectionHeading } = resolveHeadingLevels();
  const spacing = getSpacing(variant);
  const children: DocxParagraph[] = [];

  children.push(
    new Paragraph({
      heading: titleHeading,
      children: [new TextRun({ text: title })],
      spacing,
    })
  );

  children.push(
    new Paragraph({
      heading: sectionHeading,
      text: "CV",
      spacing,
    })
  );

  const summary = sanitizeTextContent(outputs.cv.summary ?? "");
  if (summary) {
    splitParagraphs(summary).forEach((line) => {
      children.push(new Paragraph({ text: line, spacing }));
    });
  }

  outputs.cv.sections.forEach((section) => {
    if (!section.title) return;
    children.push(new Paragraph({ text: section.title, spacing }));
    section.bullets.forEach((bullet) => {
      const cleaned = sanitizeTextContent(bullet);
      if (!cleaned) return;
      children.push(
        new Paragraph({
          text: cleaned,
          bullet: { level: 0 },
          spacing,
        })
      );
    });
  });

  children.push(
    new Paragraph({
      heading: sectionHeading,
      text: "Cover Letter",
      spacing,
    })
  );

  const cover = sanitizeTextContent(outputs.coverLetter ?? "");
  if (cover) {
    splitParagraphs(cover).forEach((line) => {
      children.push(new Paragraph({ text: line, spacing }));
    });
  } else {
    children.push(new Paragraph({ text: "Cover letter content not available.", spacing }));
  }

  return new Document({ sections: [{ children }] });
}
