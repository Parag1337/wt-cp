"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  adminApi,
  ACCEPTED_IMAGE_TYPES,
  AdminApiError,
  MAX_IMAGE_BYTES,
  type AdminProduct,
} from "@/lib/admin-api";
import { validateImageFile } from "@/lib/admin-form";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Crop, ImageSquare, Trash, UploadSimple, WarningCircle } from "@/lib/icons";

type Props = {
  product: AdminProduct | null;
  /** For a new product the file is held and uploaded after the product is created. */
  pendingFile: File | null;
  onPendingFileChange: (file: File | null) => void;
  onProductChange: (product: AdminProduct) => void;
  disabled?: boolean;
};

/**
 * Product image field.
 *
 * - New product: choose/preview a file; it is uploaded by the parent after creation.
 * - Existing product: uploads immediately through
 *   `POST /api/admin/products/:id/image` (multipart, 5 MB max) with progress,
 *   and supports replacing or removing the current image.
 */
export function ProductImageField({
  product,
  pendingFile,
  onPendingFileChange,
  onProductChange,
  disabled,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Object URL for the not-yet-uploaded file; revoked when the file changes.
  const pendingPreview = useMemo(
    () => (pendingFile ? URL.createObjectURL(pendingFile) : null),
    [pendingFile]
  );
  useEffect(() => {
    if (!pendingPreview) return;
    return () => URL.revokeObjectURL(pendingPreview);
  }, [pendingPreview]);

  function pick(file: File | null) {
    setLocalError(null);
    setServerError(null);
    if (!file) return;
    const error = validateImageFile(file);
    if (error) {
      setLocalError(error);
      onPendingFileChange(null);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFileName(file.name);

    if (!product) {
      onPendingFileChange(file);
      return;
    }

    void upload(file);
  }

  async function upload(file: File) {
    if (!product) return;
    setProgress(0);
    try {
      const response = await adminApi.uploadProductImage(product.id, file, (percent) =>
        setProgress(percent)
      );
      onProductChange(response.product);
      setProgress(null);
      onPendingFileChange(null);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      setProgress(null);
      setServerError(
        error instanceof AdminApiError
          ? error.message
          : "The image couldn't be uploaded. Please try again."
      );
    }
  }

  async function removeImage() {
    if (!product) {
      onPendingFileChange(null);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setRemoving(true);
    setServerError(null);
    try {
      const response = await adminApi.removeProductImage(product.id);
      onProductChange(response.product);
    } catch (error) {
      setServerError(
        error instanceof AdminApiError
          ? error.message
          : "The image couldn't be removed. Please try again."
      );
    } finally {
      setRemoving(false);
    }
  }

  const previewSrc = pendingPreview ?? product?.image ?? null;
  const busy = progress !== null || removing;

  return (
    <div className="rounded-xl border border-forest-800/15 bg-white p-4">
      <p className="text-sm font-semibold text-ink">Product photo</p>
      <p className="mt-0.5 text-xs text-forest-600">JPG, PNG or WebP · up to 5 MB · square photos look best.</p>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative aspect-square w-32 shrink-0 overflow-hidden rounded-xl border border-forest-800/10 bg-cream-100">
          {previewSrc ? (
            previewSrc.startsWith("blob:") ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob: previews can't go through the image optimizer
              <img src={previewSrc} alt="Product photo preview" className="size-full object-cover" />
            ) : (
              <Image src={previewSrc} alt="Product photo" fill sizes="128px" className="object-cover" />
            )
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-1 text-forest-400">
              <ImageSquare size={28} aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">No photo</span>
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/75 text-xs font-semibold text-forest-800">
              {removing ? "Removing…" : `${progress ?? 0}%`}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <label
              htmlFor={inputId}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-forest-800/20 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-forest-50 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-forest-600 ${
                disabled || busy ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <UploadSimple size={16} weight="bold" aria-hidden="true" />
              {previewSrc ? "Replace photo" : "Choose photo"}
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="sr-only"
              disabled={disabled || busy}
              onChange={(event) => pick(event.target.files?.[0] ?? null)}
            />
            {previewSrc && (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                disabled={disabled || busy}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 disabled:opacity-60"
              >
                <Trash size={16} aria-hidden="true" />
                {removing ? "Removing…" : "Remove"}
              </button>
            )}
          </div>

          {fileName && (
            <p className="mt-2 truncate text-xs text-forest-700">
              {fileName}
              {progress !== null && ` · uploading ${progress}%`}
              {!product && " · uploads when you save this product"}
            </p>
          )}
          {!product && !pendingFile && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-forest-600">
              <Crop size={14} aria-hidden="true" /> Saved with the product once it is created.
            </p>
          )}
          {progress !== null && (
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-cream-200"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Image upload progress"
            >
              <div className="h-full rounded-full bg-leaf-500 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          )}

          {localError && (
            <p role="alert" className="mt-2 flex items-start gap-1 text-xs font-medium text-red-700">
              <WarningCircle size={14} weight="fill" className="mt-px shrink-0" aria-hidden="true" />
              {localError}
            </p>
          )}
          {serverError && (
            <p role="alert" className="mt-2 flex items-start gap-1 text-xs font-medium text-red-700">
              <WarningCircle size={14} weight="fill" className="mt-px shrink-0" aria-hidden="true" />
              {serverError}
            </p>
          )}
          {product?.image && (
            <p className="mt-2 text-[11px] text-forest-500">
              Current photo saved. Choosing a new file replaces it straight away.
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title={product ? "Remove the product photo?" : "Remove the chosen photo?"}
        description={
          product
            ? "The photo is removed from the saved product straight away. Other product details stay as they are."
            : "The selected file is cleared. Nothing has been uploaded yet."
        }
        confirmLabel="Remove photo"
        tone="danger"
        onConfirm={async () => {
          await removeImage();
          setConfirmRemove(false);
        }}
        onClose={() => setConfirmRemove(false)}
      />
    </div>
  );
}

export { MAX_IMAGE_BYTES };
