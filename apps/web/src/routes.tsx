import type { RouteObject } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import {
  AdminCategoriesPage,
  AdminDashboardPage,
  AdminOrdersPage,
  AdminProductsPage,
  CartPage,
  CheckoutPage,
  HomePage,
  LoginPage,
  MyOrdersPage,
  NotFoundPage,
  OrderConfirmationPage,
  OrderDetailPage,
  ProductDetailPage,
  ProductFormPage,
  SignUpPage,
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
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'orders/:orderNumber/confirmation', element: <OrderConfirmationPage /> },
      { path: 'orders', element: <MyOrdersPage /> },
      { path: 'orders/:orderNumber', element: <OrderDetailPage /> },
      { path: 'admin', element: <AdminDashboardPage /> },
      { path: 'admin/categories', element: <AdminCategoriesPage /> },
      { path: 'admin/products', element: <AdminProductsPage /> },
      { path: 'admin/products/new', element: <ProductFormPage /> },
      { path: 'admin/products/:id/edit', element: <ProductFormPage /> },
      { path: 'admin/orders', element: <AdminOrdersPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
