import { describe, expect, it, vi } from 'vitest';
import { HttpApiEmailProvider, LogEmailProvider, createEmailProvider } from '../src/email.js';

describe('email provider (A-23)', () => {
  it('HttpApiEmailProvider posts the SendGrid-style payload with a Bearer key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    const provider = new HttpApiEmailProvider('https://mail.example/', 'key-1', 'from@example.com', fetchMock as typeof fetch);
    await provider.send('to@example.com', 'Subject here', 'Body text');
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('https://mail.example/v3/mail/send'); // trailing slash on endpoint tolerated
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer key-1');
    expect(headers['content-type']).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({
      personalizations: [{ to: [{ email: 'to@example.com' }] }],
      from: { email: 'from@example.com' },
      subject: 'Subject here',
      content: [{ type: 'text/plain', value: 'Body text' }],
    });
  });

  it('HttpApiEmailProvider throws on non-2xx/ok responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const provider = new HttpApiEmailProvider('https://mail.example', 'k', 'f@example.com', fetchMock as typeof fetch);
    await expect(provider.send('t@example.com', 's', 'b')).rejects.toThrow('email API responded 500');
  });

  it('LogEmailProvider only logs; factory picks HTTP only when fully configured', async () => {
    const log = vi.fn();
    const logProvider = new LogEmailProvider(log);
    await logProvider.send('t@example.com', 's', 'b');
    expect(log).toHaveBeenCalledWith('[email] would send (log-only provider)', expect.objectContaining({ to: 't@example.com' }));

    const http = createEmailProvider({ apiUrl: 'https://x', apiKey: 'k', from: 'f' }, log);
    expect(http).toBeInstanceOf(HttpApiEmailProvider);
    const logOnly = createEmailProvider({ apiUrl: null, apiKey: null, from: 'f' }, log);
    expect(logOnly).toBeInstanceOf(LogEmailProvider);
    // Partially configured (key but no URL) stays log-only.
    const half = createEmailProvider({ apiUrl: null, apiKey: 'k', from: 'f' }, log);
    expect(half).toBeInstanceOf(LogEmailProvider);
  });
});
