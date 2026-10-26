"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ADMIN_PRODUCT_CATEGORIES,
  adminApi,
  AdminApiError,
  type AdminProduct,
  type AdminProductInput,
} from "@/lib/admin-api";
import {
  EMPTY_PRODUCT_FORM,
  productToForm,
  validateProductForm,
  type ProductFormErrors,
  type ProductFormValues,
} from "@/lib/admin-form";
import { AdminCard, AdminErrorBanner, AdminSuccessBanner } from "@/components/admin/admin-ui";
import { ProductImageField } from "@/components/admin/product-image-field";
import { SelectField, TextAreaField, TextField, ToggleField } from "@/components/admin/fields";
import { ArrowLeft, FloppyDisk } from "@/lib/icons";

const CATEGORY_OPTIONS = ADMIN_PRODUCT_CATEGORIES.map((category) => ({
  value: category,
  label: category,
}));

/** Backend field errors may use different keys; map the common ones onto the form. */
const FIELD_ALIASES: Record<string, keyof ProductFormValues> = {
  name: "name",
  category: "category",
  description: "description",
  price: "price",
  stockQuantity: "stockQuantity",
  stock_quantity: "stockQuantity",
  lowStockThreshold: "lowStockThreshold",
  low_stock_threshold: "lowStockThreshold",
  available: "available",
};

export function ProductForm({
  mode,
  product: initialProduct,
}: {
  mode: "create" | "edit";
  product?: AdminProduct;
}) {
  const router = useRouter();
  const [product, setProduct] = useState<AdminProduct | null>(initialProduct ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [values, setValues] = useState<ProductFormValues>(() =>
    initialProduct ? productToForm(initialProduct) : EMPTY_PRODUCT_FORM
  );
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    setSuccess(null);
  }

  function toPayload(current: ProductFormValues): AdminProductInput {
    return {
      name: current.name.trim(),
      category: current.category,
      description: current.description.trim(),
      price: current.price.trim() === "" ? null : current.price.trim(),
      image: product?.image ?? null,
      available: current.available,
      stockQuantity: Number(current.stockQuantity),
      lowStockThreshold: Number(current.lowStockThreshold),
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setFormError(null);
    setSuccess(null);

    const validation = validateProductForm(values, ADMIN_PRODUCT_CATEGORIES);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      setFormError("Please fix the highlighted fields before saving.");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const response = await adminApi.createProduct(toPayload(values));
        let saved = response.product;
        let uploadFailed = false;
        if (pendingFile) {
          try {
            const upload = await adminApi.uploadProductImage(saved.id, pendingFile);
            saved = upload.product;
          } catch {
            uploadFailed = true;
          }
        }
        if (uploadFailed) {
          // The product exists: keep the user on the form (now in edit mode) so the
          // photo can be retried without losing their input.
          setProduct(saved);
          setValues(productToForm(saved));
          setPendingFile(null);
          setSuccess("Product created, but the photo couldn't be uploaded. Try adding it again below.");
          setSaving(false);
          return;
        }
        router.push(`/admin/products?saved=created&name=${encodeURIComponent(saved.name)}`);
        return;
      }

      if (!product) return;
      const response = await adminApi.updateProduct(product.id, toPayload(values));
      const saved = response.product;
      setProduct(saved);
      setValues(productToForm(saved));
      setSuccess("Changes saved.");
    } catch (error) {
      if (error instanceof AdminApiError) {
        const mapped: ProductFormErrors = {};
        if (error.fields) {
          for (const [key, message] of Object.entries(error.fields)) {
            const field = FIELD_ALIASES[key];
            if (field) mapped[field] = message;
          }
        }
        setErrors(mapped);
        setFormError(error.message);
      } else {
        setFormError("The product couldn't be saved. Check your connection and try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm font-semibold text-forest-700 hover:underline">
          <ArrowLeft size={16} aria-hidden="true" /> All products
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
          {mode === "create" ? "New product" : `Edit ${product?.name ?? "product"}`}
        </h1>
        <p className="mt-1 text-sm text-forest-700">
          {mode === "create"
            ? "Add a product to the shop catalogue. It becomes visible as soon as you save it."
            : `Product #${product?.id}. Price and availability changes take effect immediately in the shop.`}
        </p>
      </div>

      {success && <AdminSuccessBanner>{success}</AdminSuccessBanner>}
      {formError && <AdminErrorBanner message={formError} />}

      <form onSubmit={handleSubmit} noValidate className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <AdminCard className="space-y-4 p-5">
            <TextField
              label="Product name"
              name="name"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              error={errors.name}
              placeholder="e.g. Hybrid Maize Seeds"
              maxLength={200}
              autoComplete="off"
            />
            <SelectField
              label="Category"
              name="category"
              value={values.category}
              onChange={(event) => update("category", event.target.value)}
              error={errors.category}
              options={CATEGORY_OPTIONS}
            />
            <TextAreaField
              label="Description"
              name="description"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              error={errors.description}
              hint="Shown to customers on the product page."
              maxLength={2000}
              rows={5}
            />
          </AdminCard>

          <AdminCard className="p-5">
            <ProductImageField
              product={product}
              pendingFile={pendingFile}
              onPendingFileChange={setPendingFile}
              onProductChange={(updated) => {
                // Only the image changed on the server. Keep the rest of the form
                // exactly as the owner typed it (including unsaved edits); the
                // next save sends those values anyway.
                setProduct(updated);
                setSuccess(null);
              }}
              disabled={saving}
            />
          </AdminCard>
        </div>

        <div className="space-y-5">
          <AdminCard className="space-y-4 p-5">
            <h2 className="font-display text-sm font-bold text-ink">Pricing</h2>
            <TextField
              label="Price (₹)"
              name="price"
              inputMode="decimal"
              value={values.price}
              onChange={(event) => update("price", event.target.value)}
              error={errors.price}
              hint="Leave empty to show “Price on request” in the shop."
              placeholder="266.00"
              optional
            />
          </AdminCard>

          <AdminCard className="space-y-4 p-5">
            <h2 className="font-display text-sm font-bold text-ink">Availability &amp; stock</h2>
            <ToggleField
              label="Available in the shop"
              description="Turn off to hide it from customers without archiving."
              checked={values.available}
              onChange={(checked) => update("available", checked)}
            />
            <TextField
              label="Stock quantity"
              name="stockQuantity"
              inputMode="numeric"
              value={values.stockQuantity}
              onChange={(event) => update("stockQuantity", event.target.value)}
              error={errors.stockQuantity}
              hint="Units on hand. Adjustments are logged from the Inventory screen."
            />
            <TextField
              label="Low-stock threshold"
              name="lowStockThreshold"
              inputMode="numeric"
              value={values.lowStockThreshold}
              onChange={(event) => update("lowStockThreshold", event.target.value)}
              error={errors.lowStockThreshold}
              hint="You'll see an alert when stock reaches this number."
            />
          </AdminCard>

          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 disabled:opacity-60"
            >
              <FloppyDisk size={16} weight="bold" aria-hidden="true" />
              {saving ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
            </button>
            <Link
              href="/admin/products"
              className="rounded-full border border-forest-800/20 bg-white px-5 py-2.5 text-center text-sm font-semibold text-ink hover:bg-forest-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
