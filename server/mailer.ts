// Delivery of sign-in codes. Every message is kept in the outbox table (for the operator and the tests); in
// production a webhook (MAIL_WEBHOOK_URL) hands it to the e-mail provider. Codes are printed to the console only
// outside production.
import type { Mailer } from './app';
import type { Db } from './db';

export function makeMailer(db: Db, env: { production: boolean; webhook?: string; webhookToken?: string; log: (m: string) => void }): Mailer {
  return {
    async send(to, subject, body) {
      db.prepare('INSERT INTO outbox (recipient, subject, body, at) VALUES (?, ?, ?, ?)').run(to, subject, body, Date.now());
      db.prepare('DELETE FROM outbox WHERE at < ?').run(Date.now() - 24 * 3600_000);
      if (!env.production) env.log(`[mail to ${to}] ${subject}`);
      if (env.webhook) {
        const res = await fetch(env.webhook, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(env.webhookToken ? { authorization: `Bearer ${env.webhookToken}` } : {}) },
          body: JSON.stringify({ to, subject, text: body }),
        }).catch((e: Error) => ({ ok: false, status: e.message }) as const);
        if (!res.ok) env.log(`mail webhook failed: ${res.status}`);
      }
    },
  };
}
