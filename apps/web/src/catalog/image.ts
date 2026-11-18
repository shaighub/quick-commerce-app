import { createImageUrlSchema } from '@qc/shared';

export function imageHosts(): string[] {
  const raw = import.meta.env.VITE_IMAGE_HOSTS ?? 'images.example.com';
  return raw
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host !== '');
}

export function displayImageUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = createImageUrlSchema(imageHosts()).safeParse(value);
  return parsed.success ? value : null;
}
