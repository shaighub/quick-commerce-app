import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { createSecurity, type Security } from './auth/create-security.js';
import { createCatalogModule, type CatalogModule } from './catalog/create-catalog.js';
import { createCommerceModule, type CommerceModule } from './commerce/create-commerce.js';
import type { AppConfig } from './config/env.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { createErrorReporter } from './lib/error-reporting.js';
import type { AppLogger } from './lib/logger.js';
import { getRequestId, requestIdMiddleware } from './lib/request-id.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { createV1Router } from './routes/v1.js';

export interface AppDeps {
  config: AppConfig;
  logger: AppLogger;
  checkDb: () => Promise<boolean>;
  prisma: PrismaClient;
  now?: () => Date;
  security?: Security;
  catalog?: CatalogModule;
  commerce?: CommerceModule;
  /** Test double for the Sentry envelope POST. Production uses global fetch. */
  fetchImpl?: typeof fetch;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const directives = helmet.contentSecurityPolicy.getDefaultDirectives();
  directives['img-src'] = ["'self'", ...deps.config.imageHosts.map((host) => `https://${host}`)];
  const secured = helmet({
    contentSecurityPolicy: { directives },
  });
  const docsSecured = helmet({ contentSecurityPolicy: false });

  app.use(requestIdMiddleware);
  app.use((req, res, next) => {
    if (req.path.startsWith('/v1/docs')) {
      docsSecured(req, res, next);
      return;
    }
    secured(req, res, next);
  });
  app.use(express.json({ limit: '100kb' }));
  app.use(
    pinoHttp({
      logger: deps.logger,
      genReqId: (req) => getRequestId(req as express.Request),
      customProps: (req) => ({ requestId: getRequestId(req as express.Request) }),
    }),
  );

  // Same-origin only (ADR-004). Do not emit Access-Control-Allow-Origin.
  app.use(
    '/v1/auth',
    createRateLimiter(deps.config.rateLimitAuthMax, deps.config.rateLimitWindowMs),
  );
  app.use('/v1', createRateLimiter(deps.config.rateLimitPublicMax, deps.config.rateLimitWindowMs));
  const security =
    deps.security ??
    createSecurity({
      prisma: deps.prisma,
      config: deps.config,
      logger: deps.logger,
      ...(deps.now ? { now: deps.now } : {}),
    });
  const catalog =
    deps.catalog ??
    createCatalogModule({
      prisma: deps.prisma,
      imageHosts: deps.config.imageHosts,
      serviceablePincodes: deps.config.serviceablePincodes,
      deliveryFeePaise: deps.config.deliveryFeePaise,
    });
  const commerce =
    deps.commerce ??
    createCommerceModule({
      prisma: deps.prisma,
      config: deps.config,
      logger: deps.logger,
      ...(deps.now ? { now: deps.now } : {}),
    });
  app.use(
    '/v1',
    createV1Router({ config: deps.config, checkDb: deps.checkDb, security, catalog, commerce }),
  );
  app.use(notFoundHandler);
  const reporter = createErrorReporter({
    dsn: deps.config.sentryDsn,
    logger: {
      warn(obj: object, msg: string) {
        deps.logger.warn(obj, msg);
      },
    },
    ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
  });
  app.use(createErrorHandler(deps.logger, reporter));

  return app;
}
