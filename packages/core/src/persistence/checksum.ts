import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { SaveEnvelope } from "./types.js";

export function envelopeChecksum(envelope: Omit<SaveEnvelope, "checksum">): string {
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify({ ...envelope, checksum: "" }))));
}

export function verifiedEnvelope(raw: string, maximumBytes: number): SaveEnvelope {
  if (utf8ToBytes(raw).length > maximumBytes) throw new TypeError("Save exceeds the size limit");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new TypeError("Save is not valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Save envelope must be an object");
  const envelope = value as SaveEnvelope;
  if (envelope.format !== "e308-save" || envelope.formatVersion !== 1)
    throw new TypeError("Unsupported save format");
  if (typeof envelope.checksum !== "string") throw new TypeError("Save checksum is missing");
  const { checksum, ...payload } = envelope;
  if (envelopeChecksum(payload) !== checksum) throw new TypeError("Save checksum does not match");
  return envelope;
}
