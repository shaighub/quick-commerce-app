import { useState } from 'react';
import type { FormEvent } from 'react';
import { serviceabilityQuerySchema } from '@qc/shared';
import { ApiError } from '../../api/client.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { formatInr } from '../../catalog/money.js';

export function PincodeBanner() {
  const { api } = useAuth();
  const [pincode, setPincode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsed = serviceabilityQuerySchema.safeParse({ pincode });
    if (!parsed.success) {
      setMessage(null);
      setError(parsed.error.issues[0]?.message ?? 'Enter a 6-digit pincode');
      return;
    }
    setError(null);
    setPending(true);
    try {
      const result = await api.checkServiceability(parsed.data.pincode);
      setMessage(
        result.serviceable
          ? `We deliver to ${result.pincode}. Delivery fee ${formatInr(result.deliveryFeePaise)}.`
          : `We do not deliver to ${result.pincode} yet.`,
      );
    } catch (caught: unknown) {
      setMessage(null);
      setError(caught instanceof ApiError ? caught.message : 'Could not check delivery');
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="rounded border border-stone-200 bg-white p-4"
    >
      <h2 className="text-lg font-semibold">Delivery area</h2>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="pincode" className="text-sm font-medium">
            Delivery pincode
          </label>
          <input
            id="pincode"
            name="pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            value={pincode}
            onChange={(event) => {
              setPincode(event.target.value);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'pincode-error' : undefined}
            className="rounded border border-stone-400 px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-stone-900 px-3 py-2 text-sm text-white disabled:bg-stone-400"
        >
          {pending ? 'Checking' : 'Check'}
        </button>
      </div>
      {error ? (
        <p id="pincode-error" role="alert" className="mt-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-2 text-sm text-stone-800">
          {message}
        </p>
      ) : null}
    </form>
  );
}
