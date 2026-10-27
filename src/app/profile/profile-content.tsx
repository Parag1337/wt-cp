"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { authApi } from "../../lib/auth";
import { addressApi, type SavedAddress } from "../../lib/address-api";
import { PageHeader } from "../../components/ui/page-header";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/button";
import {
  ArrowRight,
  CheckCircle,
  ClipboardText,
  Eye,
  EyeSlash,
  LockKey,
  Phone,
  SignOut,
  Storefront,
  User,
  WarningCircle,
} from "../../lib/icons";

function ProfileSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Loading your profile</span>
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-forest-800/10 bg-white p-6 shadow-sm md:p-8">
            <div className="flex items-center gap-4">
              <Skeleton className="size-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="mt-8 space-y-4 border-t border-forest-800/5 pt-6">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function ProfileContent() {
  const router = useRouter();
  const { customer, status, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressesError, setAddressesError] = useState<string | null>(null);
  const [addressSuccess, setAddressSuccess] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [deletingAddress, setDeletingAddress] = useState(false);

  // form state
  const [formFullName, setFormFullName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddressLine1, setFormAddressLine1] = useState("");
  const [formAddressLine2, setFormAddressLine2] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("Maharashtra");
  const [formPincode, setFormPincode] = useState("");
  const [formLandmark, setFormLandmark] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const addressSectionRef = useRef<HTMLDivElement>(null);

  async function loadAddresses() {
    setAddressesLoading(true);
    setAddressesError(null);
    try {
      const data = await addressApi.list();
      setAddresses(data.addresses ?? []);
    } catch (err) {
      setAddressesError(err instanceof Error ? err.message : "Couldn't load addresses.");
    } finally {
      setAddressesLoading(false);
    }
  }

  useEffect(() => {
    loadAddresses();
  }, []);

  // Scroll to addresses section when hash present (including quick action).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const scrollToAddresses = () => {
      if (window.location.hash === "#addresses" && addressSectionRef.current) {
        addressSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    scrollToAddresses();
    window.addEventListener("hashchange", scrollToAddresses);
    return () => window.removeEventListener("hashchange", scrollToAddresses);
  }, []);

  function openAddForm() {
    setEditingAddress(null);
    setFormFullName(customer?.fullName ?? "");
    setFormPhone(customer?.phone ?? "");
    setFormAddressLine1("");
    setFormAddressLine2("");
    setFormCity("");
    setFormState("Maharashtra");
    setFormPincode("");
    setFormLandmark("");
    setFormIsDefault(addresses.length === 0);
    setFormErrors({});
    setAddressSuccess(null);
    setShowAddressForm(true);
  }

  function openEditForm(a: SavedAddress) {
    setEditingAddress(a);
    setFormFullName(a.fullName);
    setFormPhone(a.phone);
    setFormAddressLine1(a.addressLine1);
    setFormAddressLine2(a.addressLine2 ?? "");
    setFormCity(a.city);
    setFormState(a.state);
    setFormPincode(a.pincode);
    setFormLandmark(a.landmark ?? "");
    setFormIsDefault(a.isDefault);
    setFormErrors({});
    setAddressSuccess(null);
    setShowAddressForm(true);
  }

  function closeForm() {
    setShowAddressForm(false);
    setEditingAddress(null);
    setFormErrors({});
  }

  function validateForm(): boolean {
    const next: Record<string, string> = {};
    if (!formFullName.trim() || formFullName.trim().length < 2) next.fullName = "Enter your full name.";
    if (!/^[6-9]\d{9}$/.test(formPhone.trim())) next.phone = "Enter a valid 10-digit mobile number.";
    if (!formAddressLine1.trim() || formAddressLine1.trim().length < 5) next.addressLine1 = "Enter your street address.";
    if (!formCity.trim() || formCity.trim().length < 2) next.city = "Enter your city.";
    if (!formState.trim() || formState.trim().length < 2) next.state = "Enter your state.";
    if (!/^\d{6}$/.test(formPincode.trim())) next.pincode = "Enter a valid 6-digit pincode.";
    setFormErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSaveAddress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateForm()) return;
    setSavingAddress(true);
    setAddressSuccess(null);
    const payload = {
      fullName: formFullName.trim(),
      phone: formPhone.trim(),
      addressLine1: formAddressLine1.trim(),
      addressLine2: formAddressLine2.trim(),
      city: formCity.trim(),
      state: formState.trim() || "Maharashtra",
      pincode: formPincode.trim(),
      landmark: formLandmark.trim(),
      isDefault: formIsDefault,
    };
    try {
      if (editingAddress) {
        await addressApi.update(editingAddress.id, payload);
        setAddressSuccess("Address updated successfully.");
      } else {
        await addressApi.create(payload);
        setAddressSuccess("Address saved successfully.");
      }
      await loadAddresses();
      closeForm();
    } catch (err) {
      setFormErrors({ form: err instanceof Error ? err.message : "Couldn't save address." });
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleDeleteAddress(id: number) {
    setDeletingAddress(true);
    try {
      await addressApi.remove(id);
      setDeleteConfirmId(null);
      setAddressSuccess("Address deleted.");
      await loadAddresses();
    } catch (err) {
      setAddressesError(err instanceof Error ? err.message : "Couldn't delete address.");
    } finally {
      setDeletingAddress(false);
    }
  }

  function handleQuickAddresses() {
    if (addressSectionRef.current) {
      addressSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.history.replaceState(null, "", "#addresses");
  }

  if (status === "loading" || !customer) {
    return <ProfileSkeleton />;
  }

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  async function handlePasswordChange(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords don't match.");
      return;
    }

    setPwSaving(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwSuccess("Password updated successfully.");
    } catch (error) {
      setPwError(
        error instanceof Error ? error.message : "Couldn't update your password."
      );
    } finally {
      setPwSaving(false);
    }
  }

  const actions = [
    {
      href: "/shop",
      label: "Continue Shopping",
      description: "Browse the latest seeds, fertilisers and more",
      icon: <Storefront size={22} weight="bold" aria-hidden="true" />,
    },
    {
      href: "/orders",
      label: "View Orders",
      description: "Check your order history and status",
      icon: <ClipboardText size={22} weight="bold" aria-hidden="true" />,
    },
    {
      href: "/contact",
      label: "Contact Us",
      description: "Need help? Get in touch with the store",
      icon: <Phone size={22} weight="bold" aria-hidden="true" />,
    },
  ];

  return (
    <>
      <PageHeader eyebrow="My Account" title="My Profile" />
      <section className="bg-cream-50 pb-16 pt-6">
        <div className="container-site">
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-forest-800/10 bg-white p-6 shadow-sm md:p-8">
                <div className="flex items-center gap-4">
                  <span className="flex size-14 items-center justify-center rounded-full bg-forest-800 text-gold-400">
                    <User size={28} weight="bold" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-bold text-ink">
                      {customer.fullName}
                    </h2>
                    <p className="text-sm text-forest-700">Customer</p>
                  </div>
                </div>

                <h3 className="mt-8 font-display text-base font-bold text-ink">
                  Profile Information
                </h3>
                <dl className="mt-3 divide-y divide-forest-800/5">
                  <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <dt className="text-sm font-semibold text-forest-800">
                      Full Name
                    </dt>
                    <dd className="text-base text-ink sm:text-right">
                      {customer.fullName}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <dt className="text-sm font-semibold text-forest-800">
                      Email Address
                    </dt>
                    <dd className="text-base text-ink sm:text-right">
                      {customer.email}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <dt className="text-sm font-semibold text-forest-800">
                      Phone Number
                    </dt>
                    <dd className="text-base text-ink sm:text-right">
                      {customer.phone}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <dt className="text-sm font-semibold text-forest-800">
                      Password
                    </dt>
                    <dd className="text-base text-ink sm:text-right" aria-label="Password saved">
                      ••••••••
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-6 rounded-2xl border border-forest-800/10 bg-white p-6 shadow-sm md:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-forest-800/5 text-forest-700">
                    <LockKey size={22} weight="bold" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-ink">
                      Change Password
                    </h3>
                    <p className="text-xs text-forest-600">
                      Your password is stored securely and can&apos;t be displayed.
                    </p>
                  </div>
                </div>

                <form onSubmit={handlePasswordChange} className="mt-5 grid gap-4">
                  <div>
                    <label
                      htmlFor="pw-current"
                      className="mb-1.5 block text-sm font-semibold text-forest-800"
                    >
                      Current password
                    </label>
                    <div className="relative">
                      <input
                        id="pw-current"
                        type={showPasswords ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full rounded-xl border border-forest-800/20 bg-white py-2.5 pl-4 pr-11 text-sm text-ink placeholder:text-forest-400 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((s) => !s)}
                        aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-500 hover:text-forest-800"
                      >
                        {showPasswords ? (
                          <EyeSlash size={18} aria-hidden="true" />
                        ) : (
                          <Eye size={18} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="pw-new"
                        className="mb-1.5 block text-sm font-semibold text-forest-800"
                      >
                        New password
                      </label>
                      <input
                        id="pw-new"
                        type={showPasswords ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        className="w-full rounded-xl border border-forest-800/20 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-forest-400 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pw-confirm"
                        className="mb-1.5 block text-sm font-semibold text-forest-800"
                      >
                        Confirm new password
                      </label>
                      <input
                        id="pw-confirm"
                        type={showPasswords ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full rounded-xl border border-forest-800/20 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-forest-400 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                      />
                    </div>
                  </div>

                  {pwError && (
                    <p
                      role="alert"
                      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                      <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{pwError}</span>
                    </p>
                  )}
                  {pwSuccess && (
                    <p
                      role="status"
                      className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
                    >
                      <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{pwSuccess}</span>
                    </p>
                  )}

                  <div>
                    <Button type="submit" disabled={pwSaving}>
                      {pwSaving ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            <div
              id="addresses"
              ref={addressSectionRef}
              className="mt-8 rounded-2xl border border-forest-800/10 bg-white p-6 shadow-sm md:p-8"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-base font-bold text-ink">
                  Saved Addresses
                </h3>
                <Button type="button" variant="outline" size="md" onClick={openAddForm}>
                  + Add New Address
                </Button>
              </div>

              {addressSuccess && (
                <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700">
                  {addressSuccess}
                </p>
              )}
              {addressesError && (
                <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                  {addressesError}
                </p>
              )}

              {addressesLoading ? (
                <p className="mt-4 text-sm text-forest-700">Loading addresses…</p>
              ) : addresses.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-forest-800/20 p-6 text-center">
                  <p className="text-sm text-forest-700">No saved addresses yet.</p>
                  <Button type="button" className="mt-4" onClick={openAddForm}>
                    + Add New Address
                  </Button>
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {addresses.map((a) => (
                    <li key={a.id} className="rounded-xl border border-forest-800/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">
                            {a.fullName}
                            {a.isDefault ? " (Default)" : ""}
                          </p>
                          <p className="text-sm text-forest-700">{a.phone}</p>
                          <p className="mt-1 text-sm text-forest-700">
                            {a.addressLine1}
                            {a.addressLine2 ? `, ${a.addressLine2}` : ""}
                          </p>
                          {a.landmark && (
                            <p className="text-sm text-forest-700">
                              Landmark: {a.landmark}
                            </p>
                          )}
                          <p className="text-sm text-forest-700">
                            {a.city}, {a.state} - {a.pincode}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {!a.isDefault && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await addressApi.setDefault(a.id);
                                  await loadAddresses();
                                  setAddressSuccess("Default address updated.");
                                } catch (err) {
                                  setAddressesError(
                                    err instanceof Error ? err.message : "Couldn't update default."
                                  );
                                }
                              }}
                              className="text-xs font-semibold text-forest-700 underline"
                            >
                              Set default
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditForm(a)}
                            className="text-xs font-semibold text-forest-700 underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(a.id)}
                            className="text-xs font-semibold text-red-600 underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {deleteConfirmId === a.id && (
                        <div className="mt-3 rounded-lg bg-red-50 p-3">
                          <p className="text-sm text-red-700">
                            Delete this address? This cannot be undone.
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              size="md"
                              variant="outline"
                              disabled={deletingAddress}
                              onClick={() => handleDeleteAddress(a.id)}
                            >
                              {deletingAddress ? "Deleting…" : "Confirm Delete"}
                            </Button>
                            <Button
                              type="button"
                              size="md"
                              variant="outline"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {showAddressForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                    <h4 className="font-display text-lg font-bold text-ink">
                      {editingAddress ? "Edit Address" : "Add New Address"}
                    </h4>
                    <form className="mt-4 space-y-3" onSubmit={handleSaveAddress}>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-forest-800">
                          Full name
                        </label>
                        <input
                          value={formFullName}
                          onChange={(e) => setFormFullName(e.target.value)}
                          className="w-full rounded-xl border border-forest-800/20 px-4 py-2.5 text-sm"
                        />
                        {formErrors.fullName && (
                          <p className="mt-1 text-xs text-red-600">{formErrors.fullName}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-forest-800">
                          Phone number
                        </label>
                        <input
                          value={formPhone}
                          onChange={(e) => setFormPhone(e.target.value)}
                          inputMode="numeric"
                          maxLength={10}
                          className="w-full rounded-xl border border-forest-800/20 px-4 py-2.5 text-sm"
                        />
                        {formErrors.phone && (
                          <p className="mt-1 text-xs text-red-600">{formErrors.phone}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-forest-800">
                          House/flat & street
                        </label>
                        <input
                          value={formAddressLine1}
                          onChange={(e) => setFormAddressLine1(e.target.value)}
                          className="w-full rounded-xl border border-forest-800/20 px-4 py-2.5 text-sm"
                        />
                        {formErrors.addressLine1 && (
                          <p className="mt-1 text-xs text-red-600">{formErrors.addressLine1}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-forest-800">
                          Area/locality (optional)
                        </label>
                        <input
                          value={formAddressLine2}
                          onChange={(e) => setFormAddressLine2(e.target.value)}
                          className="w-full rounded-xl border border-forest-800/20 px-4 py-2.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-forest-800">
                          Landmark (optional)
                        </label>
                        <input
                          value={formLandmark}
                          onChange={(e) => setFormLandmark(e.target.value)}
                          className="w-full rounded-xl border border-forest-800/20 px-4 py-2.5 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-forest-800">
                            City
                          </label>
                          <input
                            value={formCity}
                            onChange={(e) => setFormCity(e.target.value)}
                            className="w-full rounded-xl border border-forest-800/20 px-4 py-2.5 text-sm"
                          />
                          {formErrors.city && (
                            <p className="mt-1 text-xs text-red-600">{formErrors.city}</p>
                          )}
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-forest-800">
                            State
                          </label>
                          <input
                            value={formState}
                            onChange={(e) => setFormState(e.target.value)}
                            className="w-full rounded-xl border border-forest-800/20 px-4 py-2.5 text-sm"
                          />
                          {formErrors.state && (
                            <p className="mt-1 text-xs text-red-600">{formErrors.state}</p>
                          )}
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-forest-800">
                            PIN code
                          </label>
                          <input
                            value={formPincode}
                            onChange={(e) => setFormPincode(e.target.value)}
                            inputMode="numeric"
                            maxLength={6}
                            className="w-full rounded-xl border border-forest-800/20 px-4 py-2.5 text-sm"
                          />
                          {formErrors.pincode && (
                            <p className="mt-1 text-xs text-red-600">{formErrors.pincode}</p>
                          )}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-forest-800">
                        <input
                          type="checkbox"
                          checked={formIsDefault}
                          onChange={(e) => setFormIsDefault(e.target.checked)}
                        />
                        Set as default address
                      </label>
                      {formErrors.form && (
                        <p role="alert" className="text-sm font-semibold text-red-600">
                          {formErrors.form}
                        </p>
                      )}
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={closeForm}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={savingAddress}>
                          {savingAddress ? "Saving…" : "Save Address"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>

            <aside>
              <h3 className="mb-3 font-display text-base font-bold text-ink">
                Quick Actions
              </h3>
              <nav aria-label="Quick actions" className="space-y-3">
                <button
                  type="button"
                  onClick={handleQuickAddresses}
                  className="group flex w-full items-center gap-4 rounded-xl border border-forest-800/10 bg-white p-4 text-left shadow-sm transition-colors hover:border-forest-800/25 hover:bg-forest-50"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-forest-800/5 text-forest-700 transition-colors group-hover:bg-forest-800 group-hover:text-gold-400">
                    <ClipboardText size={22} weight="bold" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      Saved Addresses
                    </span>
                    <span className="block truncate text-xs text-forest-600">
                      Manage your delivery addresses
                    </span>
                  </span>
                  <ArrowRight
                    size={18}
                    weight="bold"
                    aria-hidden="true"
                    className="text-forest-500 transition-transform group-hover:translate-x-0.5"
                  />
                </button>
                {actions.map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    className="group flex items-center gap-4 rounded-xl border border-forest-800/10 bg-white p-4 shadow-sm transition-colors hover:border-forest-800/25 hover:bg-forest-50"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-forest-800/5 text-forest-700 transition-colors group-hover:bg-forest-800 group-hover:text-gold-400">
                      {action.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">
                        {action.label}
                      </span>
                      <span className="block truncate text-xs text-forest-600">
                        {action.description}
                      </span>
                    </span>
                    <ArrowRight
                      size={18}
                      weight="bold"
                      aria-hidden="true"
                      className="text-forest-500 transition-transform group-hover:translate-x-0.5"
                    />
                  </a>
                ))}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-4 rounded-xl border border-forest-800/10 bg-white p-4 text-left shadow-sm transition-colors hover:border-red-600/30 hover:bg-red-50"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                    <SignOut size={22} weight="bold" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      Log Out
                    </span>
                    <span className="block truncate text-xs text-forest-600">
                      Sign out of your account
                    </span>
                  </span>
                </button>
              </nav>

              <div className="mt-6 rounded-xl bg-forest-800 p-5 text-gold-100">
                <p className="font-display text-sm font-bold text-gold-400">
                  Need help with your order?
                </p>
                <p className="mt-1 text-xs text-forest-100/80">
                  Call us or visit the store and we&apos;ll sort it out.
                </p>
                <Button href="/contact" variant="gold" size="md" className="mt-4">
                  Get Help
                  <ArrowRight size={16} weight="bold" aria-hidden="true" />
                </Button>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
