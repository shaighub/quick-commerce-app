import { Placeholder } from '../components/Placeholder.js';

export { HomePage } from './HomePage.js';
export { ProductDetailPage } from './ProductDetailPage.js';
export { CartPage } from './CartPage.js';
export { CheckoutPage } from './CheckoutPage.js';
export { OrderConfirmationPage } from './OrderConfirmationPage.js';
export { MyOrdersPage } from './MyOrdersPage.js';
export { OrderDetailPage } from './OrderDetailPage.js';
export { AdminCategoriesPage } from './admin/AdminCategoriesPage.js';
export { AdminProductsPage } from './admin/AdminProductsPage.js';
export { ProductFormPage } from './admin/ProductFormPage.js';
export { AdminDashboardPage } from './admin/AdminDashboardPage.js';
export { AdminOrdersPage } from './admin/AdminOrdersPage.js';
export { AdminOrderPage } from './admin/AdminOrderPage.js';

export function NotFoundPage() {
  return (
    <Placeholder id="404" title="Page not found" summary="That page is not part of the store." />
  );
}
