import { NextResponse } from "next/server";
import { backendPorts } from "@/lib/server/backend-services";
import { resolveMimoProviderConfig } from "@/lib/server/providers/mimo-ai-provider";
import type { SourceType } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        sourceType?: SourceType;
        rawText?: string;
        attachmentName?: string;
        imageDataUrl?: string;
        imageBase64?: string;
        imageMimeType?: string;
      }
    | null;

  const rawText = typeof body?.rawText === "string" ? body.rawText.trim() : "";
  const imageMimeType = normalizeImageMimeType(body?.imageMimeType);
  const imageDataUrl = normalizeImageDataUrl(body?.imageDataUrl, body?.imageBase64, imageMimeType);

  if (!body || (!rawText && !imageDataUrl)) {
    return NextResponse.json({ error: "rawText or imageDataUrl is required" }, { status: 400 });
  }

  if ((body.imageDataUrl || body.imageBase64) && !imageDataUrl) {
    return NextResponse.json({ error: "imageDataUrl must be a base64 image data URL" }, { status: 400 });
  }

  if (!rawText && imageDataUrl && !resolveMimoProviderConfig()) {
    return NextResponse.json(
      { error: "Direct image import requires a configured multimodal provider or a rawText hint." },
      { status: 503 }
    );
  }

  try {
    const result = await backendPorts.multimodalImportParser.parseImport({
      sourceType: body.sourceType ?? (imageDataUrl ? "image" : "text"),
      rawText,
      attachmentName: body.attachmentName,
      imageDataUrl,
      imageMimeType
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "multimodal import failed" },
      { status: 502 }
    );
  }
}

function normalizeImageMimeType(value: unknown) {
  return typeof value === "string" && /^image\/(?:jpeg|jpg|png|webp)$/i.test(value.trim())
    ? value.trim().toLowerCase().replace("image/jpg", "image/jpeg")
    : "image/jpeg";
}

function normalizeImageDataUrl(imageDataUrl: unknown, imageBase64: unknown, imageMimeType: string) {
  if (
    typeof imageDataUrl === "string" &&
    /^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(imageDataUrl.trim())
  ) {
    return imageDataUrl.trim().replace(/^data:image\/jpg/i, "data:image/jpeg");
  }

  if (typeof imageBase64 === "string" && /^[A-Za-z0-9+/=\r\n]+$/.test(imageBase64.trim())) {
    return `data:${imageMimeType};base64,${imageBase64.trim()}`;
  }

  return undefined;
}
