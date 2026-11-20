import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, errorBody, ErrorCodes } from '../lib/errors.js';
import { getRequestId } from '../lib/request-id.js';
import type { ErrorReporter } from '../lib/error-reporting.js';
import type { AppLogger } from '../lib/logger.js';

function isJsonParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    'status' in error &&
    (error as { status?: unknown }).status === 400 &&
    'type' in error &&
    (error as { type?: unknown }).type === 'entity.parse.failed'
  );
}

function isPayloadTooLarge(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as { type?: unknown }).type === 'entity.too.large'
  );
}

export function createErrorHandler(logger: AppLogger, reporter?: ErrorReporter) {
  return function errorHandler(
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (res.headersSent) {
      next(error);
      return;
    }

    const requestId = getRequestId(req);

    if (error instanceof AppError) {
      if (error.headers) {
        for (const [name, value] of Object.entries(error.headers)) {
          res.setHeader(name, value);
        }
      }
      const body =
        error.details === undefined
          ? errorBody(error.code, error.message, requestId)
          : errorBody(error.code, error.message, requestId, error.details);
      res.status(error.status).json(body);
      return;
    }

    if (error instanceof ZodError) {
      const onlyImageHost =
        error.issues.length > 0 &&
        error.issues.every((issue) => issue.message === ErrorCodes.IMAGE_HOST_NOT_ALLOWED);
      res.status(422).json(
        errorBody(
          onlyImageHost ? ErrorCodes.IMAGE_HOST_NOT_ALLOWED : ErrorCodes.VALIDATION,
          onlyImageHost ? 'Image host is not allowlisted' : 'Request validation failed',
          requestId,
          error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message:
              issue.message === ErrorCodes.IMAGE_HOST_NOT_ALLOWED
                ? 'Image host is not allowlisted'
                : issue.message,
          })),
        ),
      );
      return;
    }

    if (isJsonParseError(error)) {
      res
        .status(400)
        .json(errorBody(ErrorCodes.INVALID_JSON, 'Request body must be valid JSON', requestId));
      return;
    }

    if (isPayloadTooLarge(error)) {
      res
        .status(413)
        .json(errorBody(ErrorCodes.PAYLOAD_TOO_LARGE, 'Request body is too large', requestId));
      return;
    }

    logger.error({ err: error, requestId }, 'unhandled error');
    reporter?.capture(error, requestId);
    res.status(500).json(errorBody(ErrorCodes.INTERNAL_ERROR, 'Something went wrong', requestId));
  };
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, ErrorCodes.NOT_FOUND, `No route for ${req.method} ${req.path}`));
}
