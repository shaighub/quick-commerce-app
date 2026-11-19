import { afterEach, describe, expect, it } from 'vitest';
import {
  createErrorReporter,
  currentRequestId,
  installBrowserErrorReporting,
  noteRequestId,
  parseSentryDsn,
  reportApiFailure,
  reportBrowserError,
  setErrorReporter,
} from '../src/lib/error-reporting.js';

afterEach(() => {
  setErrorReporter(createErrorReporter({ dsn: undefined }));
});

describe('browser error reporting', () => {
  it('rejects an empty or non-https dsn', () => {
    expect(parseSentryDsn('http://public@sentry.example.com/1')).toBeNull();
    expect(parseSentryDsn('https://public@localhost/1')).toBeNull();
  });

  it('sends server and browser failures with the same request id', async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = (_url, init) => {
      calls.push(typeof init?.body === 'string' ? init.body : '');
      return Promise.resolve(new Response(null, { status: 200 }));
    };
    setErrorReporter(
      createErrorReporter({ dsn: 'https://public@sentry.example.com/7', fetchImpl }),
    );
    noteRequestId('req-web-7');
    reportApiFailure(404, 'req-web-7', 'missing');
    reportApiFailure(500, 'req-web-7', 'Something went wrong');
    reportBrowserError(new Error('render failed'));
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(currentRequestId()).toBe('req-web-7');
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('req-web-7');
    expect(calls[0]).toContain('Something went wrong');
    expect(calls[1]).toContain('render failed');
    expect(calls.join('')).not.toContain('missing');
  });

  it('swallows a transport failure and removes the window listener', async () => {
    const captured: unknown[] = [];
    setErrorReporter({
      capture(error) {
        captured.push(error);
      },
    });
    const remove = installBrowserErrorReporting();
    window.dispatchEvent(new ErrorEvent('error', { message: 'boom', error: new Error('boom') }));
    remove();
    window.dispatchEvent(new ErrorEvent('error', { message: 'later' }));
    expect(captured).toHaveLength(1);

    const fetchImpl: typeof fetch = () => Promise.reject(new Error('network'));
    createErrorReporter({ dsn: 'https://public@sentry.example.com/7', fetchImpl }).capture(
      'plain',
      'req-plain',
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
});
