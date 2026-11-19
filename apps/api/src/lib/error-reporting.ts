import { randomUUID } from 'node:crypto';

export interface ReportedError {
  name: string;
  message: string;
  requestId: string;
}

export interface ErrorReporter {
  capture(error: unknown, requestId: string): void;
}

export interface SentryTarget {
  envelopeUrl: string;
  publicKey: string;
  dsn: string;
}

interface ReporterOptions {
  dsn: string | undefined;
  fetchImpl?: typeof fetch;
  logger?: { warn: (obj: object, msg: string) => void };
}

/** https DSN with a public key and a numeric project id. Anything else is ignored. */
export function parseSentryDsn(dsn: string): SentryTarget | null {
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return null;
  }
  const projectId = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (url.protocol !== 'https:' || url.username === '' || !/^\d+$/.test(projectId)) {
    return null;
  }
  if (url.hostname === '' || url.hostname === 'localhost' || url.hostname.endsWith('.local')) {
    return null;
  }
  return {
    dsn,
    publicKey: decodeURIComponent(url.username),
    envelopeUrl: `https://${url.host}/api/${projectId}/envelope/`,
  };
}

export function toReportedError(error: unknown, requestId: string): ReportedError {
  if (error instanceof Error) {
    return { name: error.name || 'Error', message: error.message, requestId };
  }
  return { name: 'Error', message: 'Unknown error', requestId };
}

export function sentryEnvelope(target: SentryTarget, event: ReportedError): string {
  const eventId = randomUUID().replaceAll('-', '');
  const header = JSON.stringify({
    event_id: eventId,
    dsn: target.dsn,
    sent_at: new Date().toISOString(),
  });
  const item = JSON.stringify({ type: 'event' });
  const payload = JSON.stringify({
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: 'error',
    logger: 'qc',
    exception: { values: [{ type: event.name, value: event.message }] },
    tags: { requestId: event.requestId },
  });
  return `${header}\n${item}\n${payload}\n`;
}

/**
 * Sends unhandled errors to Sentry when SENTRY_DSN is set (ADR-017).
 * The body is the exception name, message, and request id. Redirects are refused.
 */
export function createErrorReporter(options: ReporterOptions): ErrorReporter {
  const target = options.dsn ? parseSentryDsn(options.dsn) : null;
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    capture(error: unknown, requestId: string): void {
      if (!target) {
        return;
      }
      const event = toReportedError(error, requestId);
      const body = sentryEnvelope(target, event);
      void fetchImpl(target.envelopeUrl, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/x-sentry-envelope',
          'x-sentry-auth': `Sentry sentry_version=7, sentry_client=qc-error-report/0.5.0, sentry_key=${target.publicKey}`,
        },
        body,
      }).catch(() => {
        options.logger?.warn({ requestId }, 'error report failed');
      });
    },
  };
}
