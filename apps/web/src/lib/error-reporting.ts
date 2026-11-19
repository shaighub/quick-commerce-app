import { randomUUID } from 'node:crypto';

export interface ReportedError {
  name: string;
  message: string;
  requestId: string;
}

export interface ErrorReporter {
  capture(error: unknown, requestId: string): void;
}

interface SentryTarget {
  envelopeUrl: string;
  publicKey: string;
  dsn: string;
}

let lastRequestId = 'unknown';
let active: ErrorReporter = createErrorReporter({ dsn: import.meta.env.VITE_SENTRY_DSN });

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

export function createErrorReporter(options: {
  dsn: string | undefined;
  fetchImpl?: typeof fetch;
}): ErrorReporter {
  const target = options.dsn ? parseSentryDsn(options.dsn) : null;
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    capture(error: unknown, requestId: string): void {
      if (!target) {
        return;
      }
      const event = toReportedError(error, requestId);
      const eventId = randomUUID().replaceAll('-', '');
      const body = [
        JSON.stringify({ event_id: eventId, dsn: target.dsn, sent_at: new Date().toISOString() }),
        JSON.stringify({ type: 'event' }),
        JSON.stringify({
          event_id: eventId,
          timestamp: Date.now() / 1000,
          platform: 'javascript',
          level: 'error',
          logger: 'qc-web',
          exception: { values: [{ type: event.name, value: event.message }] },
          tags: { requestId: event.requestId },
        }),
      ].join('\n');
      void fetchImpl(target.envelopeUrl, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/x-sentry-envelope',
          'x-sentry-auth': `Sentry sentry_version=7, sentry_client=qc-error-report/0.5.0, sentry_key=${target.publicKey}`,
        },
        body,
      }).catch(() => undefined);
    },
  };
}

export function setErrorReporter(reporter: ErrorReporter): void {
  active = reporter;
}

export function noteRequestId(requestId: string): void {
  lastRequestId = requestId;
}

export function currentRequestId(): string {
  return lastRequestId;
}

/** Browser failures use the request id of the latest API call (NFR-OPS-02). */
export function reportBrowserError(error: unknown): void {
  active.capture(error, lastRequestId);
}

export function reportApiFailure(status: number, requestId: string, message: string): void {
  if (status < 500) {
    return;
  }
  active.capture(new Error(message), requestId);
}

export function installBrowserErrorReporting(): () => void {
  const onError = (event: ErrorEvent): void => {
    reportBrowserError(event.error instanceof Error ? event.error : new Error(event.message));
  };
  window.addEventListener('error', onError);
  return () => {
    window.removeEventListener('error', onError);
  };
}
