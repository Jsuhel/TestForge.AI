import mammoth from "mammoth";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

export interface ExtractedText {
  text: string;
  pages: number;
}

/**
 * Extract plain text from an uploaded FSD file (PDF, DOCX or TXT).
 * Runs server-side only.
 */
export async function extractText(
  buffer: Buffer,
  filename: string,
): Promise<ExtractedText> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const pdf = await getDocumentProxy(uint8);
    const { text, totalPages } = await extractPdfText(pdf, { mergePages: true });
    const content = (Array.isArray(text) ? text.join("\n\n") : text) ?? "";
    return {
      text: content,
      pages: totalPages ?? 1,
    };
  }

  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value ?? "";
    // Rough page estimate: ~500 words per page.
    const pages = Math.max(1, Math.round(text.split(/\s+/).length / 500));
    return { text, pages };
  }

  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    const text = buffer.toString("utf8");
    const pages = Math.max(1, Math.round(text.split(/\s+/).length / 500));
    return { text, pages };
  }

  throw new Error("Unsupported file type. Please upload a PDF, DOCX or TXT file.");
}
