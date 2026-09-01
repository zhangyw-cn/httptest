const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return uuidV4FromBytes(randomBytes(16));
}

export function uuidV4FromBytes(bytes: Uint8Array): string {
  if (bytes.length < 16) {
    throw new Error("uuidV4FromBytes requires 16 bytes");
  }
  const b = bytes.slice(0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isUuidV4(id: string): boolean {
  return UUID_V4.test(id);
}

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < n; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}
