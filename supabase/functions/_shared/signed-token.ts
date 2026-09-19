const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signToken(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  if (secret.length < 32) throw new Error("token_secret_not_configured");
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(encodedPayload),
  );
  return `${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyToken<T extends Record<string, unknown>>(
  token: string,
  secret: string,
  purpose: string,
): Promise<T | null> {
  if (secret.length < 32) return null;
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;
  try {
    const signatureBytes = base64UrlDecode(encodedSignature);
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      new Uint8Array(signatureBytes).buffer,
      encoder.encode(encodedPayload),
    );
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(base64UrlDecode(encodedPayload))) as T;
    if (payload.purpose !== purpose || Number(payload.exp ?? 0) < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
