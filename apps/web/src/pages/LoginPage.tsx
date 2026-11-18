import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { loginSchema } from '@qc/shared';
import { ApiError } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.js';
import { detailsToFields, fieldErrors, formErrorMessage } from '../auth/messages.js';
import { safeNextPath } from '../auth/safe-next.js';
import { TextField } from '../components/TextField.js';

const fields = ['email', 'password'] as const;

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    document.title = 'Log in · Quick Commerce';
  }, []);

  useEffect(() => {
    if (formError) {
      document.getElementById('login-error')?.focus();
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
    document.getElementById('login-error')?.focus();
  }

  async function onSubmit(): Promise<void> {
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const nextErrors = fieldErrors(parsed.error.issues);
      setErrors(nextErrors);
      focusErrors(nextErrors);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await auth.login(parsed.data);
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

  const signupTo = next ? `/signup?next=${encodeURIComponent(next)}` : '/signup';

  return (
    <article className="max-w-md">
      <h1 className="text-3xl font-semibold">Log in</h1>
      <p className="mt-3 text-stone-700">Use the email and password for your account.</p>
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
            id="login-error"
            role="alert"
            tabIndex={-1}
            className="rounded bg-red-100 px-3 py-2 text-sm text-red-950"
          >
            {formError}
          </p>
        ) : null}
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
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          inputRef={(node) => {
            refs.current.password = node;
          }}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-stone-900 px-4 py-2 font-medium text-white disabled:bg-stone-700"
        >
          {pending ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-stone-700">
        New here? <Link to={signupTo}>Sign up</Link>
      </p>
    </article>
  );
}
