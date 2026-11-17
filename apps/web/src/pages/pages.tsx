import { useParams } from 'react-router-dom';
import { Placeholder } from '../components/Placeholder.js';

export function HomePage() {
  return (
    <Placeholder
      id="S01"
      title="Home and product list"
      summary="Browse categories and search products. Catalog browsing arrives in a later milestone."
    />
  );
}

export function ProductDetailPage() {
  const { slug } = useParams();
  return (
    <Placeholder
      id="S02"
      title="Product detail"
      summary={`Product ${slug ?? ''} will show price, unit, and stock in a later milestone.`}
    />
  );
}

export function SignUpPage() {
  return (
    <Placeholder
      id="S03"
      title="Sign up"
      summary="Customer registration arrives in a later milestone."
    />
  );
}

export function LoginPage() {
  return (
    <Placeholder
      id="S04"
      title="Log in"
      summary="Email and password sign-in arrives in a later milestone."
    />
  );
}

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

export function AdminCategoriesPage() {
  return (
    <Placeholder
      id="A02"
      title="Categories"
      summary="Category and subcategory management arrives in a later milestone."
    />
  );
}

export function AdminProductsPage() {
  return (
    <Placeholder
      id="A03"
      title="Products"
      summary="The admin product list arrives in a later milestone."
    />
  );
}

export function ProductFormPage() {
  const { id } = useParams();
  const creating = id === undefined;
  return (
    <Placeholder
      id="A04"
      title={creating ? 'New product' : 'Edit product'}
      summary={
        creating
          ? 'Product creation arrives in a later milestone.'
          : `Editing product ${id} arrives in a later milestone.`
      }
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
