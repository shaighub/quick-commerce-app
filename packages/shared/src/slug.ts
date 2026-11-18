/**
 * Storefront address derived from a name. Lowercase letters, digits, and single hyphens.
 * Category and subcategory slugs are assigned once at create (ADR-014) and stay put on rename.
 */
export function slugify(value: string, maxLength: number): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug;
}
