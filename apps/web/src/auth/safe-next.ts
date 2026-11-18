/** Only follow relative paths from ?next=, so login cannot become an open redirect. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/';
  }
  if (value.includes('://')) {
    return '/';
  }
  return value;
}
