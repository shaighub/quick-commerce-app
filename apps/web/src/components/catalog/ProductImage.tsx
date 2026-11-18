import { displayImageUrl } from '../../catalog/image.js';

export function ProductImage({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  const src = displayImageUrl(imageUrl);
  if (!src) {
    return (
      <div className="flex h-40 items-center justify-center bg-stone-200 text-sm text-stone-800">
        No image
      </div>
    );
  }
  return <img src={src} alt={name} className="h-40 w-full object-cover" />;
}
