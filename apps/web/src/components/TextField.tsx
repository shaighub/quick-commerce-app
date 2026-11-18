import type { Ref } from 'react';

export function TextField({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
  error,
  hint,
  inputRef,
}: {
  id: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'tel';
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint ? hintId : undefined, error ? errorId : undefined]
    .filter((item) => item !== undefined)
    .join(' ');

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-stone-900">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm text-stone-700">
          {hint}
        </p>
      ) : null}
      <input
        ref={inputRef}
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        className="rounded border border-stone-400 bg-white px-3 py-2 text-base text-stone-900"
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
