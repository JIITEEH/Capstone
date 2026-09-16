// Identifies a file by what is inside it, not by what it is called. Anyone can rename a program
// to "chapter1.pdf", so the first bytes of the file ("magic numbers") decide what we accept.
import fs from 'node:fs/promises';

// Longest signature below, so one small read covers every check
export const HEADER_BYTES = 8;

export const TYPE_LABELS = { pdf: 'PDF', doc: 'DOC', docx: 'DOCX' };

export const TYPE_BY_EXTENSION = { '.pdf': 'pdf', '.doc': 'doc', '.docx': 'docx' };

const SIGNATURES = [
  // Every PDF starts with "%PDF-"
  { type: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  // Word 97-2003 files are OLE2 compound documents
  { type: 'doc', bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  // DOCX is a ZIP archive of XML parts, so it starts with a local file header: "PK\x03\x04".
  // Empty (PK\x05\x06) and spanned (PK\x07\x08) archives are not documents and stay rejected.
  { type: 'docx', bytes: [0x50, 0x4b, 0x03, 0x04] },
];

// The type a file really is, or null when it matches nothing we accept
export function detectType(header) {
  const match = SIGNATURES.find(({ bytes }) => bytes.every((byte, index) => header[index] === byte));
  return match?.type ?? null;
}

export async function readHeader(filePath) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(HEADER_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, HEADER_BYTES, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
