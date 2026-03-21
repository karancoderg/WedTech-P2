/**
 * Client-side helper to encrypt a value via the server-side API.
 * Use this in "use client" components instead of importing encrypt directly,
 * since the ENCRYPTION_KEY env var is not available in the browser.
 */
export async function encryptValue(value: string): Promise<string> {
  if (!value) return "";
  const res = await fetch("/api/encrypt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error("Encryption failed");
  const data = await res.json();
  return data.encrypted;
}
