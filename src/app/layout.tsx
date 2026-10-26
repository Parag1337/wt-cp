import type { Metadata, Viewport } from "next";
import { Manrope, Poppins } from "next/font/google";
import { AuthProvider } from "../lib/auth-context";
import { CartProvider } from "../lib/cart-context";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const TITLE =
  "Jay Hari Krushi Seva Kendra | Agricultural Products in Khamgaon";
const DESCRIPTION =
  "Jay Hari Krushi Seva Kendra in Khamgaon, Maharashtra. Explore seeds, fertilizers, pesticides and agricultural products for your farming needs.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "Krushi Seva Kendra Khamgaon",
    "Agricultural products Khamgaon",
    "Seeds Khamgaon",
    "Fertilizers Khamgaon",
    "Pesticides Khamgaon",
    "Agricultural store Khamgaon",
    "Farming products Maharashtra",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: "en_IN",
    siteName: "Jay Hari Krushi Seva Kendra",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbfaf6",
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Jay Hari Krushi Seva Kendra",
  telephone: "+91 91126 54020",
  address: {
    "@type": "PostalAddress",
    streetAddress:
      "Lokhandkar Complex, Near Natraj Garden, Natraj Garden Road, Baradari",
    addressLocality: "Khamgaon",
    addressRegion: "Maharashtra",
    postalCode: "444303",
    addressCountry: "IN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${manrope.variable} antialiased`}
    >
      <body className="flex min-h-full flex-col bg-cream-50 text-ink">
        <AuthProvider>{children}</AuthProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
      </body>
    </html>
  );
}