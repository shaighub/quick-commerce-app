import { ErrorCodes } from '@qc/shared';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown[] | undefined;

  constructor(status: number, code: string, message: string, details?: unknown[]) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorBody(
  code: string,
  message: string,
  requestId: string,
  details?: unknown[],
): { error: { code: string; message: string; details?: unknown[]; requestId: string } } {
  return {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
      requestId,
    },
  };
}

export { ErrorCodes };
