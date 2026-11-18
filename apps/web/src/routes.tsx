import type { RouteObject } from 'react-router-dom';
import { RequireAdmin, RequireCustomer } from './auth/guards.js';
import { Layout } from './components/Layout.js';
import { LoginPage } from './pages/LoginPage.js';
import { SignUpPage } from './pages/SignUpPage.js';
import {
  AdminCategoriesPage,
  AdminDashboardPage,
  AdminOrderPage,
  AdminOrdersPage,
  AdminProductsPage,
  CartPage,
  CheckoutPage,
  HomePage,
  MyOrdersPage,
  NotFoundPage,
  OrderConfirmationPage,
  OrderDetailPage,
  ProductDetailPage,
  ProductFormPage,
} from './pages/pages.js';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'search', element: <HomePage /> },
      { path: 'p/:slug', element: <ProductDetailPage /> },
      { path: 'signup', element: <SignUpPage /> },
      { path: 'login', element: <LoginPage /> },
      {
        element: <RequireCustomer />,
        children: [
          { path: 'cart', element: <CartPage /> },
          { path: 'checkout', element: <CheckoutPage /> },
          { path: 'orders/:orderNumber/confirmation', element: <OrderConfirmationPage /> },
          { path: 'orders', element: <MyOrdersPage /> },
          { path: 'orders/:orderNumber', element: <OrderDetailPage /> },
        ],
      },
      {
        element: <RequireAdmin />,
        children: [
          { path: 'admin', element: <AdminDashboardPage /> },
          { path: 'admin/categories', element: <AdminCategoriesPage /> },
          { path: 'admin/products', element: <AdminProductsPage /> },
          { path: 'admin/products/new', element: <ProductFormPage /> },
          { path: 'admin/products/:id/edit', element: <ProductFormPage /> },
          { path: 'admin/orders', element: <AdminOrdersPage /> },
          { path: 'admin/orders/:orderNumber', element: <AdminOrderPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
