export const BUSINESS = {
  name: "Jay Hari Krushi Seva Kendra",
  phone: "+91 91126 54020",
  phoneHref: "tel:+919112654020",
  address: {
    line1: "Lokhandkar Complex, Near Natraj Garden,",
    line2: "Natraj Garden Road, Baradari,",
    line3: "Khamgaon - 444303, Maharashtra",
  },
  city: "Khamgaon, Maharashtra",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Lokhandkar+Complex%2C+Near+Natraj+Garden%2C+Natraj+Garden+Road%2C+Baradari%2C+Khamgaon%2C+Maharashtra+444303",
  mapsEmbed:
    "https://www.google.com/maps?q=Lokhandkar%20Complex%2C%20Near%20Natraj%20Garden%2C%20Natraj%20Garden%20Road%2C%20Baradari%2C%20Khamgaon%2C%20Maharashtra%20444303&output=embed",
};

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Products", href: "/products" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "/contact" },
];

export const CUSTOMER_NAV_LINKS = [
  { label: "Shop", href: "/shop" },
  { label: "Products", href: "/shop/products" },
  { label: "Orders", href: "/orders" },
];

export const STORE_HOURS = {
  weekdays: "Monday - Saturday: 8:00 AM - 8:00 PM",
  sunday: "Sunday: Closed",
};

export const img = (seed: string, w: number, h: number) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

export type TrustItem = {
  title: string;
  text: string;
};

export const TRUST_ITEMS: TrustItem[] = [
  {
    title: "Quality Products",
    text: "Agricultural products for farming requirements.",
  },
  {
    title: "Agricultural Solutions",
    text: "Seeds, fertilizers, pesticides and other agricultural products.",
  },
  {
    title: "Farmer Focused",
    text: "Serving the needs of local farmers and customers.",
  },
  {
    title: "Local Store",
    text: "Conveniently located in Khamgaon, Maharashtra.",
  },
];

export type Category = {
  title: string;
  text: string;
  cta: string;
  image: string;
  alt: string;
};

export const CATEGORIES: Category[] = [
  {
    title: "Seeds",
    text: "Seeds for different farming requirements and crop cycles.",
    cta: "Explore Seeds",
    image: img("agricultural-seeds", 900, 600),
    alt: "Packs of agricultural seeds for different crop cycles",
  },
  {
    title: "Fertilizers",
    text: "Agricultural fertilizers and nutrients for farming requirements.",
    cta: "Explore Fertilizers",
    image: img("fertilizer-bags", 900, 600),
    alt: "Bags of agricultural fertilizer and soil nutrients",
  },
  {
    title: "Pesticides",
    text: "Agricultural crop-protection products for different farming needs.",
    cta: "Explore Pesticides",
    image: img("crop-protection", 900, 600),
    alt: "Crop protection products for agricultural use",
  },
  {
    title: "Agricultural Products",
    text: "Essential agricultural products and inputs for day-to-day farming requirements.",
    cta: "View Products",
    image: img("farm-tools-inputs", 900, 600),
    alt: "Agricultural tools and farming inputs at the store",
  },
];

export type FeaturedProduct = {
  title: string;
  text: string;
  image: string;
  alt: string;
};

export const FEATURED_PRODUCTS: FeaturedProduct[] = [
  {
    title: "Seeds",
    text: "Seeds for seasonal crops and different farming needs.",
    image: img("store-seeds", 800, 600),
    alt: "Seeds available at the store",
  },
  {
    title: "Fertilizer",
    text: "Fertilizers and nutrients for crop growth.",
    image: img("store-fertilizer", 800, 600),
    alt: "Fertilizer products available at the store",
  },
  {
    title: "Crop Care",
    text: "Products for plant protection and crop care.",
    image: img("store-crop-care", 800, 600),
    alt: "Crop care products available at the store",
  },
  {
    title: "Pesticides",
    text: "Crop protection products for farming needs.",
    image: img("store-pesticides", 800, 600),
    alt: "Pesticide products available at the store",
  },
  {
    title: "Agricultural Inputs",
    text: "Day-to-day farming inputs in one place.",
    image: img("store-inputs", 800, 600),
    alt: "Agricultural inputs available at the store",
  },
  {
    title: "Other Products",
    text: "More agricultural essentials at our store.",
    image: img("store-other", 800, 600),
    alt: "Other agricultural products available at the store",
  },
];

export type WhyItem = {
  title: string;
  text: string;
};

export const WHY_ITEMS: WhyItem[] = [
  {
    title: "Quality Products",
    text: "Carefully selected agricultural products for farming requirements.",
  },
  {
    title: "Local & Accessible",
    text: "Conveniently located in Khamgaon for local customers and farmers.",
  },
  {
    title: "Wide Range",
    text: "Seeds, fertilizers, pesticides and other agricultural products in one place.",
  },
  {
    title: "Farmer Focused",
    text: "Focused on serving the practical needs of farmers and customers.",
  },
];

export type Step = {
  title: string;
  text: string;
};

export const STEPS: Step[] = [
  {
    title: "Identify Your Requirement",
    text: "Find the agricultural product category you need.",
  },
  {
    title: "Explore Available Products",
    text: "Browse seeds, fertilizers, pesticides and agricultural products.",
  },
  {
    title: "Visit Our Store",
    text: "Come to Jay Hari Krushi Seva Kendra in Khamgaon.",
  },
  {
    title: "Get the Products You Need",
    text: "Contact us or visit the store for your requirements.",
  },
];

export type GalleryItem = {
  title: string;
  image: string;
  lightbox: string;
  alt: string;
  aspect: string;
};

export const GALLERY: GalleryItem[] = [
  {
    title: "Seeds",
    image: img("gallery-seeds", 600, 800),
    lightbox: img("gallery-seeds", 1200, 1600),
    alt: "Agricultural seeds in the store",
    aspect: "aspect-[3/4]",
  },
  {
    title: "Fertilizers",
    image: img("gallery-fertilizers", 600, 450),
    lightbox: img("gallery-fertilizers", 1600, 1200),
    alt: "Fertilizer products in the store",
    aspect: "aspect-[4/3]",
  },
  {
    title: "Pesticides",
    image: img("gallery-pesticides", 600, 600),
    lightbox: img("gallery-pesticides", 1200, 1200),
    alt: "Pesticide products in the store",
    aspect: "aspect-square",
  },
  {
    title: "Crop Care",
    image: img("gallery-crop-care", 600, 800),
    lightbox: img("gallery-crop-care", 1200, 1600),
    alt: "Crop care products in the store",
    aspect: "aspect-[3/4]",
  },
  {
    title: "Agricultural Products",
    image: img("gallery-agri-products", 600, 450),
    lightbox: img("gallery-agri-products", 1600, 1200),
    alt: "Agricultural products on display",
    aspect: "aspect-[4/3]",
  },
  {
    title: "Store Interior",
    image: img("gallery-store-interior", 600, 800),
    lightbox: img("gallery-store-interior", 1200, 1600),
    alt: "Interior of Jay Hari Krushi Seva Kendra",
    aspect: "aspect-[3/4]",
  },
  {
    title: "Product Shelves",
    image: img("gallery-shelves", 600, 450),
    lightbox: img("gallery-shelves", 1600, 1200),
    alt: "Product shelves at the agricultural store",
    aspect: "aspect-[4/3]",
  },
  {
    title: "Farming Products",
    image: img("gallery-farming-products", 600, 600),
    lightbox: img("gallery-farming-products", 1200, 1200),
    alt: "Farming products available at the store",
    aspect: "aspect-square",
  },
];