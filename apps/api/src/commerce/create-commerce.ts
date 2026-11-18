import type { AppConfig } from '../config/env.js';
import { createCartController, type CartController } from '../controllers/cart.controller.js';
import { createJobsController, type JobsController } from '../controllers/jobs.controller.js';
import { createOrderController, type OrderController } from '../controllers/order.controller.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { AppLogger } from '../lib/logger.js';
import { createMockGateway } from '../payments/mock-gateway.js';
import type { PaymentGateway } from '../payments/gateway.js';
import { createCartRepository } from '../repositories/cart.repository.js';
import { createOrderRepository } from '../repositories/order.repository.js';
import { createCartService, type CartService } from '../services/cart.service.js';
import { createOrderNumberService } from '../services/order-number.service.js';
import { createOrderService, type OrderService } from '../services/order.service.js';
import { createPaymentService } from '../services/payment.service.js';

export interface CommerceModule {
  carts: CartService;
  orders: OrderService;
  cartController: CartController;
  orderController: OrderController;
  jobs: JobsController;
}

export function createCommerceModule(deps: {
  prisma: PrismaClient;
  config: Pick<AppConfig, 'deliveryFeePaise' | 'serviceablePincodes' | 'jobsToken'>;
  logger: AppLogger;
  gateway?: PaymentGateway;
  now?: () => Date;
}): CommerceModule {
  const carts = createCartRepository(deps.prisma);
  const orders = createOrderRepository(deps.prisma);
  const cartService = createCartService({
    carts,
    deliveryFeePaise: deps.config.deliveryFeePaise,
  });
  const gateway = deps.gateway ?? createMockGateway();
  const orderService = createOrderService({
    prisma: deps.prisma,
    orders,
    carts,
    numbers: createOrderNumberService(),
    payments: createPaymentService(gateway),
    deliveryFeePaise: deps.config.deliveryFeePaise,
    serviceablePincodes: deps.config.serviceablePincodes,
    now: deps.now ?? (() => new Date()),
    logger: deps.logger,
  });
  return {
    carts: cartService,
    orders: orderService,
    cartController: createCartController(cartService),
    orderController: createOrderController(orderService),
    jobs: createJobsController({ orders: orderService, jobsToken: deps.config.jobsToken }),
  };
}
