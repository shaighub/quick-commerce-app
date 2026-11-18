import { useEffect } from 'react';

export function Placeholder({
  id,
  title,
  summary,
}: {
  id: string;
  title: string;
  summary: string;
}) {
  useEffect(() => {
    document.title = `${title} · Quick Commerce`;
  }, [title]);

  return (
    <article>
      <p className="text-sm font-medium uppercase tracking-wide text-stone-600">{id}</p>
      <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-stone-700">{summary}</p>
    </article>
  );
}
