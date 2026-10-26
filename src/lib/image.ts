// Identify the real image type from its leading bytes instead of trusting the
// client-supplied file.type / file name.
export function detectImageType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: "image/jpeg", ext: "jpg" };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mimeType: "image/png", ext: "png" };
  }
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return { mimeType: "image/webp", ext: "webp" };
  }
  return null;
}
