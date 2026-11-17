/**
 * A-23: pluggable email. When EMAIL_API_URL/EMAIL_API_KEY are configured, sends through
 * a SendGrid-compatible HTTP API; otherwise log-only (current behavior, no email in dev).
 */

export interface EmailProvider {
  send(to: string, subject: string, text: string): Promise<void>;
}

type LogFn = (msg: string, meta?: Record<string, unknown>) => void;

export class LogEmailProvider implements EmailProvider {
  constructor(private readonly log: LogFn) {}

  async send(to: string, subject: string, text: string): Promise<void> {
    this.log('[email] would send (log-only provider)', { to, subject, text });
  }
}

interface SendGridPayload {
  personalizations: { to: { email: string }[] }[];
  from: { email: string };
  subject: string;
  content: { type: string; value: string }[];
}

export class HttpApiEmailProvider implements EmailProvider {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(to: string, subject: string, text: string): Promise<void> {
    const payload: SendGridPayload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: this.from },
      subject,
      content: [{ type: 'text/plain', value: text }],
    };
    const res = await this.fetchImpl(`${this.endpoint.replace(/\/$/, '')}/v3/mail/send`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`email API responded ${res.status}`);
    }
  }
}

export interface EmailConfig {
  apiUrl: string | null;
  apiKey: string | null;
  from: string;
}

export function createEmailProvider(config: EmailConfig, log: LogFn): EmailProvider {
  if (config.apiUrl && config.apiKey) {
    return new HttpApiEmailProvider(config.apiUrl, config.apiKey, config.from, fetch);
  }
  return new LogEmailProvider(log);
}
