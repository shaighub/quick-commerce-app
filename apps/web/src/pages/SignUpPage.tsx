import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { signupSchema } from '@qc/shared';
import { ApiError } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.js';
import { detailsToFields, fieldErrors, formErrorMessage } from '../auth/messages.js';
import { safeNextPath } from '../auth/safe-next.js';
import { TextField } from '../components/TextField.js';

const fields = ['name', 'email', 'password', 'phone'] as const;

export function SignUpPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    document.title = 'Sign up · Quick Commerce';
  }, []);

  useEffect(() => {
    if (formError) {
      document.getElementById('signup-error')?.focus();
    }
  }, [formError]);

  if (auth.status === 'loading') {
    return (
      <p role="status" className="text-stone-700">
        Checking your session…
      </p>
    );
  }
  if (auth.user) {
    return <Navigate to={safeNextPath(next)} replace />;
  }

  function focusErrors(nextErrors: Record<string, string>): void {
    const first = fields.find((field) => nextErrors[field]);
    if (first) {
      refs.current[first]?.focus();
      return;
    }
    document.getElementById('signup-error')?.focus();
  }

  async function onSubmit(): Promise<void> {
    setFormError(null);
    const parsed = signupSchema.safeParse({
      name,
      email,
      password,
      ...(phone.trim() === '' ? {} : { phone }),
    });
    if (!parsed.success) {
      const nextErrors = fieldErrors(parsed.error.issues);
      setErrors(nextErrors);
      focusErrors(nextErrors);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await auth.signup(parsed.data);
      void navigate(safeNextPath(next));
    } catch (error: unknown) {
      setPending(false);
      if (error instanceof ApiError && error.status === 422) {
        const nextErrors = detailsToFields(error.details);
        if (Object.keys(nextErrors).length > 0) {
          setErrors(nextErrors);
          focusErrors(nextErrors);
          return;
        }
      }
      setFormError(
        error instanceof ApiError ? formErrorMessage(error) : 'Something went wrong. Try again.',
      );
    }
  }

  const loginTo = next ? `/login?next=${encodeURIComponent(next)}` : '/login';

  return (
    <article className="max-w-md">
      <h1 className="text-3xl font-semibold">Sign up</h1>
      <p className="mt-3 text-stone-700">
        Create a customer account. You will be signed in immediately.
      </p>
      <form
        className="mt-6 flex flex-col gap-4"
        noValidate
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        {formError ? (
          <p
            id="signup-error"
            role="alert"
            tabIndex={-1}
            className="rounded bg-red-100 px-3 py-2 text-sm text-red-950"
          >
            {formError}
          </p>
        ) : null}
        <TextField
          id="name"
          label="Name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={setName}
          error={errors.name}
          inputRef={(node) => {
            refs.current.name = node;
          }}
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
          inputRef={(node) => {
            refs.current.email = node;
          }}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
          inputRef={(node) => {
            refs.current.password = node;
          }}
        />
        <TextField
          id="phone"
          label="Phone (optional)"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={setPhone}
          error={errors.phone}
          hint="Include the country code, for example +919876543210."
          inputRef={(node) => {
            refs.current.phone = node;
          }}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-stone-900 px-4 py-2 font-medium text-white disabled:bg-stone-700"
        >
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm text-stone-700">
        Already have an account? <Link to={loginTo}>Log in</Link>
      </p>
    </article>
  );
}
