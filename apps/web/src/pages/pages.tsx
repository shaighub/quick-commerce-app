import { useParams } from 'react-router-dom';
import { Placeholder } from '../components/Placeholder.js';

export { HomePage } from './HomePage.js';
export { ProductDetailPage } from './ProductDetailPage.js';
export { AdminCategoriesPage } from './admin/AdminCategoriesPage.js';
export { AdminProductsPage } from './admin/AdminProductsPage.js';
export { ProductFormPage } from './admin/ProductFormPage.js';

export function CartPage() {
  return (
    <Placeholder
      id="S05"
      title="Cart"
      summary="Cart quantities and totals arrive in a later milestone."
    />
  );
}

export function CheckoutPage() {
  return (
    <Placeholder
      id="S06"
      title="Checkout"
      summary="Address and mock payment arrive in a later milestone."
    />
  );
}

export function OrderConfirmationPage() {
  const { orderNumber } = useParams();
  return (
    <Placeholder
      id="S07"
      title="Order confirmation"
      summary={`Confirmation for ${orderNumber ?? 'this order'} arrives in a later milestone.`}
    />
  );
}

export function MyOrdersPage() {
  return (
    <Placeholder id="S08" title="My orders" summary="Order history arrives in a later milestone." />
  );
}

export function OrderDetailPage() {
  const { orderNumber } = useParams();
  return (
    <Placeholder
      id="S09"
      title="Order detail"
      summary={`Details for ${orderNumber ?? 'this order'} arrive in a later milestone.`}
    />
  );
}

export function AdminDashboardPage() {
  return (
    <Placeholder
      id="A01"
      title="Admin dashboard"
      summary="Today's orders, revenue, and low stock arrive in a later milestone."
    />
  );
}

export function AdminOrdersPage() {
  return (
    <Placeholder
      id="A05"
      title="Admin orders"
      summary="Order filters and status updates arrive in a later milestone."
    />
  );
}

export function NotFoundPage() {
  return (
    <Placeholder id="404" title="Page not found" summary="That page is not part of the store." />
  );
}
