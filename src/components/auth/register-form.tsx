"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle, WarningCircle } from "../../lib/icons";
import { Button } from "../button";
import { FormField } from "./form-field";
import { useAuth } from "../../lib/auth-context";

type Errors = {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
};

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);

  function validate(): boolean {
    const next: Errors = {};
    if (!fullName.trim()) {
      next.fullName = "Please enter your name.";
    } else if (fullName.trim().length < 2) {
      next.fullName = "Please enter your name.";
    }
    if (!email.trim()) {
      next.email = "Please enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Please enter a valid email address.";
    }
    if (!phone.trim()) {
      next.phone = "Please enter your phone number.";
    } else if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(phone.trim())) {
      next.phone = "Please enter a valid phone number.";
    }
    if (!password) {
      next.password = "Password must be at least 8 characters.";
    } else if (password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    }
    if (!confirmPassword) {
      next.confirmPassword = "Please confirm your password.";
    } else if (confirmPassword !== password) {
      next.confirmPassword = "Passwords do not match.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
      });
      setCreated(true);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="rounded-2xl border border-forest-800/10 bg-white p-8 text-center shadow-md md:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-leaf-100 text-forest-700">
          <CheckCircle size={28} weight="fill" aria-hidden="true" />
        </span>
        <h2 className="mt-5 font-display text-xl font-bold text-ink">
          Account created successfully.
        </h2>
        <p className="mt-2 leading-relaxed text-forest-800">
          Welcome to Jay Hari Krushi Seva Kendra. Your account is ready!
        </p>
        <Button
          size="lg"
          className="mt-7 w-full"
          onClick={() => {
            const redirectParam = new URLSearchParams(window.location.search).get(
              "redirect"
            );
            router.push(
              redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
                ? redirectParam
                : "/shop"
            );
          }}
        >
          Continue to Shop
          <ArrowRight size={18} weight="bold" aria-hidden="true" />
        </Button>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-semibold text-forest-700 underline-offset-4 transition-colors hover:text-forest-900 hover:underline"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="rounded-2xl border border-forest-800/10 bg-white p-6 shadow-md md:p-8"
    >
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-forest-800 text-gold-400">
          <CheckCircle size={24} weight="bold" aria-hidden="true" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
          Create Your Account
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-forest-800">
          Join Jay Hari Krushi Seva Kendra and stay connected with our
          agricultural products and services.
        </p>
      </div>

      {formError && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <WarningCircle
            size={18}
            weight="fill"
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>{formError}</span>
        </div>
      )}

      <div className="mt-6 grid gap-5">
        <FormField
          id="fullName"
          label="Full Name"
          autoComplete="name"
          placeholder="Enter your full name"
          value={fullName}
          onChange={setFullName}
          error={errors.fullName}
        />

        <FormField
          id="email"
          label="Email Address"
          type="email"
          autoComplete="username"
          placeholder="Enter your email"
          value={email}
          onChange={setEmail}
          error={errors.email}
        />

        <FormField
          id="phone"
          label="Phone Number"
          type="tel"
          autoComplete="tel"
          placeholder="Enter your phone number"
          value={phone}
          onChange={setPhone}
          error={errors.phone}
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          value={password}
          onChange={setPassword}
          error={errors.password}
        >
          <p className="text-xs text-forest-800">
            Use at least 8 characters.
          </p>
        </FormField>

        <FormField
          id="confirmPassword"
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={errors.confirmPassword}
        />
      </div>

      <Button
        type="submit"
        size="lg"
        className="mt-6 w-full"
        disabled={submitting}
      >
        {submitting ? "Creating Account..." : "Create Account"}
        {!submitting && <ArrowRight size={18} weight="bold" aria-hidden="true" />}
      </Button>

      <p className="mt-6 text-center text-sm text-forest-800">
        Already have an account?{" "}
        <a
          href="/login"
          className="font-semibold text-forest-700 underline-offset-4 transition-colors hover:text-forest-900 hover:underline"
        >
          Login
        </a>
      </p>
    </form>
  );
}