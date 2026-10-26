import {
  Drop,
  Grains,
  MapPin,
  Plant,
  SealCheck,
  Storefront,
  Tractor,
  Users,
  type Icon,
} from "./icons";

export type ShopCategory = {
  slug: string;
  label: string;
  description: string;
  icon: Icon;
};

export const SHOP_CATEGORIES: ShopCategory[] = [
  {
    slug: "Seeds",
    label: "Seeds",
    description: "Quality seeds for all crops",
    icon: Grains,
  },
  {
    slug: "Fertilizers",
    label: "Fertilizers",
    description: "Nutrients for better yield",
    icon: Plant,
  },
  {
    slug: "Pesticides",
    label: "Pesticides",
    description: "Crop protection solutions",
    icon: Drop,
  },
  {
    slug: "Agricultural Products",
    label: "Agricultural Products",
    description: "Farming tools and inputs",
    icon: Tractor,
  },
];

export const SHOP_BENEFITS = [
  {
    title: "Quality Agricultural Products",
    text: "Carefully selected seeds, fertilizers and crop-care products.",
    icon: SealCheck,
  },
  {
    title: "Convenient Local Store",
    text: "Located in Khamgaon for local farmers and customers.",
    icon: MapPin,
  },
  {
    title: "Wide Product Range",
    text: "Everything from seeds to farm tools in one place.",
    icon: Storefront,
  },
  {
    title: "Farmer-Focused Service",
    text: "Practical guidance for your farming requirements.",
    icon: Users,
  },
];

export function categoryHref(slug: string) {
  return `/shop/products?category=${encodeURIComponent(slug)}`;
}
