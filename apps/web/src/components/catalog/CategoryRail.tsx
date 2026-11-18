import type { PublicCategory } from '@qc/shared';

export function CategoryRail({
  categories,
  categorySlug,
  subcategorySlug,
  onCategory,
  onSubcategory,
}: {
  categories: PublicCategory[];
  categorySlug: string;
  subcategorySlug: string;
  onCategory: (slug: string) => void;
  onSubcategory: (category: string, subcategory: string) => void;
}) {
  const selected = categories.find((category) => category.slug === categorySlug);
  return (
    <nav aria-label="Categories">
      <ul className="flex flex-col gap-2">
        <li>
          <button
            type="button"
            className="text-left underline-offset-4 hover:underline"
            aria-current={categorySlug === '' ? 'true' : undefined}
            onClick={() => {
              onCategory('');
            }}
          >
            All
          </button>
        </li>
        {categories.map((category) => (
          <li key={category.id}>
            <button
              type="button"
              className="text-left font-medium underline-offset-4 hover:underline"
              aria-current={category.slug === categorySlug ? 'true' : undefined}
              onClick={() => {
                onCategory(category.slug);
              }}
            >
              {category.name}
            </button>
            {selected?.id === category.id ? (
              <ul className="ml-4 mt-1 flex flex-col gap-1">
                {category.subcategories.map((subcategory) => (
                  <li key={subcategory.id}>
                    <button
                      type="button"
                      className="text-left text-sm underline-offset-4 hover:underline"
                      aria-current={subcategory.slug === subcategorySlug ? 'true' : undefined}
                      onClick={() => {
                        onSubcategory(category.slug, subcategory.slug);
                      }}
                    >
                      {subcategory.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}
