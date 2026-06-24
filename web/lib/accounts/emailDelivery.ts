export interface VerificationEmailDeliveryResult {
  delivery: "webhook" | "console";
  previewUrl: string | null;
}

async function postEmailWebhook({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const webhookUrl = process.env.ACCOUNT_EMAIL_WEBHOOK_URL?.trim();
  const webhookSecret = process.env.ACCOUNT_EMAIL_WEBHOOK_SECRET?.trim();

  if (!webhookUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ACCOUNT_EMAIL_WEBHOOK_URL is required in production");
    }
    console.info(`[account-email] ${to}\n${text}`);
    return;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (webhookSecret) {
    headers.Authorization = `Bearer ${webhookSecret}`;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ to, subject, text }),
  });

  if (!response.ok) {
    throw new Error(`Email webhook failed with status ${response.status}`);
  }
}

export async function sendAccountVerificationEmail({
  to,
  verificationUrl,
}: {
  to: string;
  verificationUrl: string;
}): Promise<VerificationEmailDeliveryResult> {
  const webhookUrl = process.env.ACCOUNT_EMAIL_WEBHOOK_URL?.trim();
  const subject = "Confirm your Babson Analytics account";
  const text = [
    "Confirm your Babson Analytics account by opening this link:",
    verificationUrl,
    "",
    "This link expires in 20 minutes.",
  ].join("\n");

  await postEmailWebhook({ to, subject, text });

  return {
    delivery: webhookUrl ? "webhook" : "console",
    previewUrl: webhookUrl || process.env.NODE_ENV === "production" ? null : verificationUrl,
  };
}

export async function sendPendingAccountNotificationEmail({
  to,
  requesterEmail,
  adminUrl,
}: {
  to: string;
  requesterEmail: string;
  adminUrl: string;
}): Promise<void> {
  await postEmailWebhook({
    to,
    subject: "Babson Analytics account approval needed",
    text: [
      "A new Babson Analytics account is waiting for approval.",
      "",
      `Requester: ${requesterEmail}`,
      `Review: ${adminUrl}`,
    ].join("\n"),
  });
}
