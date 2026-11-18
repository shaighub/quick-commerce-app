import { Link } from 'react-router-dom';

export function Breadcrumb({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap gap-2 text-sm text-stone-800">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex gap-2">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {item.to && !last ? (
                <Link className="underline-offset-4 hover:underline" to={item.to}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
