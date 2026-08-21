const fromBase64Url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), char => char.charCodeAt(0));
const toBase64Url = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
async function key() {
  const secret = Deno.env.get("GIPO_SETTINGS_ENCRYPTION_KEY"); if (!secret) throw new Error("SERVER_MISCONFIGURED");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptSetting(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(value)));
  const payload = new Uint8Array(iv.length + encrypted.length); payload.set(iv); payload.set(encrypted, iv.length); return toBase64Url(payload);
}
export async function decryptSetting(value: string) {
  const payload = fromBase64Url(value); if (payload.length <= 28) throw new Error("SETTINGS_MALFORMED");
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: payload.slice(0, 12) }, await key(), payload.slice(12)));
}
