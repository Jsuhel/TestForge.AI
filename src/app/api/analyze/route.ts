import { extractText } from "@/lib/extract";
import { analyzeDocument } from "@/lib/analyze";

const MAX_FILE_MB = 25;
const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "No file was uploaded." }, { status: 400 });
    }

    const lower = file.name.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      return Response.json(
        { error: `Unsupported file type. Allowed: ${SUPPORTED_EXTENSIONS.join(", ")}` },
        { status: 415 },
      );
    }

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      return Response.json(
        { error: `File is too large. Maximum size is ${MAX_FILE_MB}MB.` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { text, pages } = await extractText(buffer, file.name);

    if (!text.trim()) {
      return Response.json(
        {
          error:
            "No text could be extracted from this file. It may be a scanned/image-only PDF — please upload a text-based document.",
        },
        { status: 422 },
      );
    }

    const analysis = await analyzeDocument(text, file.name, pages);
    return Response.json(analysis);
  } catch (error) {
    console.error("[api/analyze] failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to analyze the document.";
    return Response.json({ error: message }, { status: 500 });
  }
}
