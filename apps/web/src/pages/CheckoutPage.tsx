import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { checkoutSchema, priceChangedDetailSchema, paymentFailedDetailSchema } from '@qc/shared';
import { ApiError } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.js';
import { formatInr } from '../catalog/money.js';
import { cartQueryKey, useCart } from '../commerce/use-cart.js';
import { TextField } from '../components/TextField.js';

type Simulate = 'success' | 'failure';

export function CheckoutPage() {
  const { api } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.me(),
    staleTime: 0,
  });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [simulate, setSimulate] = useState<Simulate>('success');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [priceChange, setPriceChange] = useState<{ previous: number; next: number } | null>(null);
  const filled = useRef(false);
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    document.title = 'Checkout · Quick Commerce';
  }, []);

  useEffect(() => {
    const address = me.data?.user.lastAddress;
    if (!address || filled.current) {
      return;
    }
    filled.current = true;
    setName(address.name);
    setPhone(address.phone);
    setLine1(address.line1);
    setLine2(address.line2 ?? '');
    setCity(address.city);
    setState(address.state);
    setPincode(address.pincode);
  }, [me.data]);

  const serviceability = useQuery({
    queryKey: ['serviceability', pincode],
    enabled: /^[1-9][0-9]{5}$/.test(pincode),
    staleTime: 60_000,
    queryFn: () => api.checkServiceability(pincode),
  });

  const blocked = cart.data?.items.some((line) => !line.available) ?? true;
  const total = cart.data?.totalPaise;

  async function place(expectedTotalPaise: number): Promise<void> {
    setFormError(null);
    setFieldErrors({});
    const parsed = checkoutSchema.safeParse({
      address: {
        name,
        phone,
        line1,
        line2: line2.trim() === '' ? undefined : line2,
        city,
        state,
        pincode,
      },
      payment: { method: 'MOCK', simulate },
      expectedTotalPaise,
    });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[issue.path.length - 1];
        if (typeof key === 'string' && nextErrors[key] === undefined) {
          nextErrors[key] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }
    if (serviceability.data && !serviceability.data.serviceable) {
      setFormError('Delivery is not available for this pincode.');
      return;
    }
    setPending(true);
    try {
      const order = await api.checkout(parsed.data, idempotencyKey.current);
      await queryClient.invalidateQueries({ queryKey: cartQueryKey });
      void navigate(`/orders/${order.orderNumber}/confirmation`);
    } catch (error: unknown) {
      setPending(false);
      if (error instanceof ApiError && error.code === 'PRICE_CHANGED') {
        const detail = priceChangedDetailSchema.safeParse(error.details?.[0]);
        if (detail.success) {
          setPriceChange({ previous: expectedTotalPaise, next: detail.data.totalPaise });
          await queryClient.invalidateQueries({ queryKey: cartQueryKey });
          return;
        }
      }
      if (error instanceof ApiError && error.code === 'PAYMENT_FAILED') {
        const detail = paymentFailedDetailSchema.safeParse(error.details?.[0]);
        const number = detail.success ? ` Order ${detail.data.orderNumber}.` : '';
        setFormError(`Payment failed.${number} Your cart is unchanged. You can try again.`);
        idempotencyKey.current = crypto.randomUUID();
        return;
      }
      setFormError(error instanceof ApiError ? error.message : 'Checkout could not be completed.');
      idempotencyKey.current = crypto.randomUUID();
    }
  }

  return (
    <article className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">Checkout</h1>
      {cart.isLoading ? <p role="status">Loading checkout</p> : null}
      {cart.isError ? (
        <p role="alert" className="text-red-800">
          Checkout could not be loaded.
        </p>
      ) : null}
      {cart.data && cart.data.items.length === 0 ? (
        <p>
          Your cart is empty. <Link to="/cart">Back to cart</Link>
        </p>
      ) : null}
      {cart.data && cart.data.items.length > 0 ? (
        <div className="grid gap-8 md:grid-cols-2">
          <form
            className="flex flex-col gap-4"
            noValidate
            aria-busy={pending}
            onSubmit={(event) => {
              event.preventDefault();
              if (total !== undefined) {
                void place(total);
              }
            }}
          >
            <h2 className="text-xl font-semibold">Delivery address</h2>
            {formError ? (
              <p role="alert" className="rounded bg-red-100 px-3 py-2 text-sm text-red-950">
                {formError}
              </p>
            ) : null}
            {priceChange ? (
              <div className="rounded bg-amber-100 px-3 py-3 text-amber-950">
                <p>
                  The total changed from {formatInr(priceChange.previous)} to{' '}
                  {formatInr(priceChange.next)}. Confirm to place the order at the new total.
                </p>
                <button
                  type="button"
                  className="mt-3 rounded bg-stone-900 px-4 py-2 font-medium text-white"
                  onClick={() => {
                    idempotencyKey.current = crypto.randomUUID();
                    setPriceChange(null);
                    void place(priceChange.next);
                  }}
                >
                  Confirm new total
                </button>
              </div>
            ) : null}
            <TextField
              id="name"
              label="Name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={setName}
              error={fieldErrors.name}
            />
            <TextField
              id="phone"
              label="Mobile number"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={setPhone}
              error={fieldErrors.phone}
              hint="10-digit Indian mobile"
            />
            <TextField
              id="line1"
              label="Address line 1"
              type="text"
              autoComplete="address-line1"
              value={line1}
              onChange={setLine1}
              error={fieldErrors.line1}
            />
            <TextField
              id="line2"
              label="Address line 2"
              type="text"
              autoComplete="address-line2"
              value={line2}
              onChange={setLine2}
              error={fieldErrors.line2}
            />
            <TextField
              id="city"
              label="City"
              type="text"
              autoComplete="address-level2"
              value={city}
              onChange={setCity}
              error={fieldErrors.city}
            />
            <TextField
              id="state"
              label="State"
              type="text"
              autoComplete="address-level1"
              value={state}
              onChange={setState}
              error={fieldErrors.state}
            />
            <TextField
              id="pincode"
              label="Pincode"
              type="text"
              autoComplete="postal-code"
              value={pincode}
              onChange={setPincode}
              error={fieldErrors.pincode}
            />
            {serviceability.data ? (
              <p role="status">
                {serviceability.data.serviceable
                  ? `We deliver to ${serviceability.data.pincode}.`
                  : `We do not deliver to ${serviceability.data.pincode}.`}
              </p>
            ) : null}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Mock payment</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="simulate"
                  value="success"
                  checked={simulate === 'success'}
                  onChange={() => {
                    setSimulate('success');
                  }}
                />
                Simulate success
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="simulate"
                  value="failure"
                  checked={simulate === 'failure'}
                  onChange={() => {
                    setSimulate('failure');
                    idempotencyKey.current = crypto.randomUUID();
                  }}
                />
                Simulate failure
              </label>
            </fieldset>
            <button
              type="submit"
              disabled={
                pending ||
                blocked ||
                total === undefined ||
                serviceability.data?.serviceable === false
              }
              className="rounded bg-stone-900 px-4 py-2 font-medium text-white disabled:bg-stone-700"
            >
              {pending ? 'Placing order…' : 'Place order'}
            </button>
          </form>
          <section aria-label="Order summary" className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Order summary</h2>
            <ul className="flex flex-col gap-2">
              {cart.data.items.map((line) => (
                <li key={line.id} className="flex justify-between gap-4">
                  <span>
                    {line.product.name} × {line.quantity}
                    {line.available ? '' : ' (unavailable)'}
                  </span>
                  <span>{formatInr(line.lineTotalPaise)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt>Subtotal</dt>
              <dd className="text-right">{formatInr(cart.data.subtotalPaise)}</dd>
              <dt>Delivery</dt>
              <dd className="text-right">{formatInr(cart.data.deliveryFeePaise)}</dd>
              <dt className="font-semibold">Total</dt>
              <dd className="text-right font-semibold">{formatInr(cart.data.totalPaise)}</dd>
            </dl>
          </section>
        </div>
      ) : null}
    </article>
  );
}
