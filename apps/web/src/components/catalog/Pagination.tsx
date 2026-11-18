export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const last = Math.min(20, Math.max(1, Math.ceil(total / pageSize)));
  if (total <= pageSize) {
    return null;
  }
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center gap-4">
      <button
        type="button"
        className="rounded border border-stone-400 bg-white px-3 py-2 text-sm disabled:text-stone-400"
        disabled={page <= 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        Previous
      </button>
      <p className="text-sm text-stone-800">
        Page {page} of {last}
      </p>
      <button
        type="button"
        className="rounded border border-stone-400 bg-white px-3 py-2 text-sm disabled:text-stone-400"
        disabled={page >= last}
        onClick={() => {
          onPage(page + 1);
        }}
      >
        Next
      </button>
    </nav>
  );
}
