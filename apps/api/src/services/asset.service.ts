import { AppError } from "../lib/app-error.js";
import { AssetModel } from "../models/Asset.js";
import type { AttachmentKind } from "../types/domain.js";
import { PDFParse } from "pdf-parse";

const pdfMimeType = "application/pdf";
const maxExtractedTextLength = 20_000;

export interface UploadFileInput {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
  size: number;
}

export interface SerializedAttachment {
  id: string;
  kind: AttachmentKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string;
  dataUrl: string | null;
}

export function getAttachmentKind(mimeType: string): AttachmentKind | null {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType === pdfMimeType) {
    return "pdf";
  }

  return null;
}

export function assertSupportedAttachmentMimeType(mimeType: string) {
  const kind = getAttachmentKind(mimeType);

  if (!kind) {
    throw new AppError("Only image and PDF uploads are supported.", 400);
  }

  return kind;
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxExtractedTextLength);
}

export async function extractAttachmentText(input: UploadFileInput) {
  const kind = getAttachmentKind(input.mimetype);

  if (kind !== "pdf") {
    return "";
  }

  let parser: PDFParse | null = null;

  try {
    parser = new PDFParse({ data: input.buffer });
    const result = await parser.getText();
    return normalizeExtractedText(result.text);
  } catch (error) {
    console.warn("PDF text extraction failed, continuing without extracted text.", error);
    return "";
  } finally {
    if (parser) {
      await parser.destroy();
    }
  }
}

export async function createAssetFromUpload(input: {
  ownerId: string;
  purpose: "exercise_source" | "submission_work";
  file: UploadFileInput;
  extractedText?: string;
}) {
  const kind = assertSupportedAttachmentMimeType(input.file.mimetype);
  const extractedText =
    input.extractedText ?? (kind === "pdf" ? await extractAttachmentText(input.file) : "");

  const asset = await AssetModel.create({
    ownerId: input.ownerId,
    purpose: input.purpose,
    kind,
    originalName: input.file.originalName,
    mimeType: input.file.mimetype,
    sizeBytes: input.file.size,
    dataUrl: `data:${input.file.mimetype};base64,${input.file.buffer.toString("base64")}`,
    extractedText,
  });

  return asset;
}

export async function getOwnedAssetOrThrow(input: {
  assetId: string;
  ownerId: string;
  purpose?: "exercise_source" | "submission_work";
}) {
  const asset = await AssetModel.findOne({
    _id: input.assetId,
    ownerId: input.ownerId,
    ...(input.purpose ? { purpose: input.purpose } : {}),
  });

  if (!asset) {
    throw new AppError("Uploaded source file not found.", 404);
  }

  return asset;
}

export function serializeAttachment(
  asset: {
    _id: unknown;
    kind: AttachmentKind;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    extractedText?: string;
    dataUrl?: string;
  },
  options?: { includeDataUrl?: boolean },
): SerializedAttachment {
  return {
    id: String(asset._id),
    kind: asset.kind,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    extractedText: asset.extractedText ?? "",
    dataUrl: options?.includeDataUrl ? asset.dataUrl ?? null : null,
  };
}
