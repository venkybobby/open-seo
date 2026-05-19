import { env } from "cloudflare:workers";

function getOptionalEnv(name: string) {
  const value: unknown = Reflect.get(env, name);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function sendWeeklyReportEmail(input: {
  to: string[];
  subject: string;
  html: string;
  pdfBytes: Uint8Array;
  pdfFilename: string;
  fromName: string;
}) {
  if (input.to.length === 0) {
    console.warn("[weekly-report] No recipients — skipping send");
    return;
  }

  const apiKey = getOptionalEnv("RESEND_API_KEY");
  const fromEmail =
    getOptionalEnv("RESEND_FROM_EMAIL") ?? "reports@openseo.so";

  if (!apiKey) {
    console.warn(
      "[weekly-report] RESEND_API_KEY not set — skipping email delivery",
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: `${input.fromName} <${fromEmail}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: [
        {
          filename: input.pdfFilename,
          content: bytesToBase64(input.pdfBytes),
        },
      ],
    }),
  });

  if (response.ok) {
    return;
  }

  const errorPayload = await response.text().catch(() => "");
  console.error("[weekly-report] Resend error:", {
    status: response.status,
    errorPayload,
    recipientCount: input.to.length,
  });
  throw new Error(`Failed to send weekly report email (${response.status})`);
}
