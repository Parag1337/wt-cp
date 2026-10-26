import Image from "next/image";
import { Crop } from "../../lib/icons";

type ProductImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
};

export function ProductImage({
  src,
  alt,
  className = "aspect-[4/3]",
  imageClassName = "object-cover",
  priority = false,
  sizes,
}: ProductImageProps) {
  if (src) {
    return (
      <div className={`relative overflow-hidden bg-cream-100 ${className}`}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes ?? "(min-width: 1024px) 33vw, 90vw"}
          className={imageClassName}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-leaf-100/60 ${className}`}
      role="img"
      aria-label={`${alt} (photo coming soon)`}
    >
      <span className="w-1/3 max-w-24 text-forest-800/15">
        <Crop size={96} className="h-auto w-full" aria-hidden="true" />
      </span>
    </div>
  );
}
