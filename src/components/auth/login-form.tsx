"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, WarningCircle } from "../../lib/icons";
import { Button } from "../button";
import { FormField } from "./form-field";
import { useAuth } from "../../lib/auth-context";

type Errors = {
  email?: string;
  password?: string;
};

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const next: Errors = {};
    if (!email.trim()) {
      next.email = "Please enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Please enter a valid email address.";
    }
    if (!password) {
      next.password = "Please enter your password.";
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
      await login(email.trim().toLowerCase(), password);
      const redirectParam = new URLSearchParams(window.location.search).get(
        "redirect"
      );
      const destination =
        redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
          ? redirectParam
          : "/shop";
      router.push(destination);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="rounded-2xl border border-forest-800/10 bg-white p-6 shadow-md md:p-8"
    >
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-forest-800 text-gold-400">
          <ArrowRight size={24} weight="bold" aria-hidden="true" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
          Welcome Back
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-forest-800">
          Login to your customer account.
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
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={setPassword}
          error={errors.password}
        />
      </div>

      <Button
        type="submit"
        size="lg"
        className="mt-6 w-full"
        disabled={submitting}
      >
        {submitting ? "Logging in..." : "Login"}
        {!submitting && <ArrowRight size={18} weight="bold" aria-hidden="true" />}
      </Button>

      <p className="mt-6 text-center text-sm text-forest-800">
        Don&apos;t have an account?{" "}
        <a
          href="/register"
          className="font-semibold text-forest-700 underline-offset-4 transition-colors hover:text-forest-900 hover:underline"
        >
          Create an account
        </a>
      </p>
    </form>
  );
}