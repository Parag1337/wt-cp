"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle, Phone, WarningCircle } from "@phosphor-icons/react";
import { BUSINESS } from "../lib/site";
import { inquiryApi } from "../lib/api";
import { Button } from "./button";
import { Reveal } from "./reveal";

const REQUIREMENTS = [
  "Seeds",
  "Fertilizers",
  "Pesticides",
  "Agricultural Products",
  "Other",
];

type Errors = {
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  requirement?: string;
};

const inputClasses =
  "w-full rounded-xl border border-forest-800/20 bg-white px-4 py-3 text-base text-ink placeholder:text-forest-600 focus:border-forest-600 focus:outline-2 focus:outline-offset-0 focus:outline-forest-600 transition-colors";

export function InquiryForm() {
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const requirement = String(data.get("requirement") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    const next: Errors = {};
    if (!name) next.name = "Please enter your name.";
    if (!phone) {
      next.phone = "Please enter your phone number.";
    } else if (!/^[+]?[\d\s-]{10,15}$/.test(phone)) {
      next.phone = "Please enter a valid phone number.";
    }
    if (!email) {
      next.email = "Please enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Please enter a valid email address.";
    }
    if (!requirement) next.requirement = "Please select a requirement.";
    if (!message) next.message = "Please enter a message.";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await inquiryApi.submit({
        name,
        phone,
        email: email.toLowerCase(),
        product: requirement || null,
        message,
      });
      setSubmitted(true);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="inquiry" className="scroll-mt-24 bg-white">
      <div className="container-site py-20 lg:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">
            Have a Farming-Related Requirement?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-forest-800">
            Send us your inquiry and our team can help you with your
            agricultural product requirements.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mx-auto mt-10 max-w-2xl">
          {submitted ? (
            <div className="rounded-2xl border border-forest-800/10 bg-white p-8 text-center shadow-md md:p-12">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-leaf-100 text-forest-700">
                <CheckCircle size={28} weight="fill" aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-display text-xl font-bold text-ink">
                Thank you!
              </h3>
              <p className="mt-2 leading-relaxed text-forest-800">
                Your inquiry has been submitted successfully. Our team will get
                back to you at the earliest.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-forest-800">
                For a faster response, call us at{" "}
                <a
                  href={BUSINESS.phoneHref}
                  className="font-semibold text-forest-700 underline-offset-4 hover:underline"
                >
                  {BUSINESS.phone}
                </a>
                .
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-6 text-sm font-semibold text-forest-700 underline-offset-4 transition-colors hover:text-forest-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-600"
              >
                Send another inquiry
              </button>
            </div>
          ) : (
            <>
              {formError && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
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

              <form
                noValidate
                onSubmit={handleSubmit}
                className="rounded-2xl border border-forest-800/10 bg-white p-6 shadow-md md:p-8"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="name"
                      className="text-sm font-semibold text-ink"
                    >
                      Full Name <span aria-hidden="true" className="text-red-700">*</span>
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Enter your name"
                      required
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? "name-error" : undefined}
                      className={inputClasses}
                    />
                    {errors.name && (
                      <p id="name-error" className="text-sm text-red-700">
                        {errors.name}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="phone"
                      className="text-sm font-semibold text-ink"
                    >
                      Phone Number <span aria-hidden="true" className="text-red-700">*</span>
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="Enter your phone number"
                      required
                      aria-invalid={Boolean(errors.phone)}
                      aria-describedby={errors.phone ? "phone-error" : undefined}
                      className={inputClasses}
                    />
                    {errors.phone && (
                      <p id="phone-error" className="text-sm text-red-700">
                        {errors.phone}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label
                      htmlFor="email"
                      className="text-sm font-semibold text-ink"
                    >
                      Email Address <span aria-hidden="true" className="text-red-700">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                      required
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "email-error" : undefined}
                      className={inputClasses}
                    />
                    {errors.email && (
                      <p id="email-error" className="text-sm text-red-700">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label
                      htmlFor="requirement"
                      className="text-sm font-semibold text-ink"
                    >
                      Requirement <span aria-hidden="true" className="text-red-700">*</span>
                    </label>
                    <select
                      id="requirement"
                      name="requirement"
                      required
                      defaultValue=""
                      aria-invalid={Boolean(errors.requirement)}
                      aria-describedby={
                        errors.requirement ? "requirement-error" : undefined
                      }
                      className={inputClasses}
                    >
                      <option value="" disabled>
                        Select a requirement
                      </option>
                      {REQUIREMENTS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {errors.requirement && (
                      <p id="requirement-error" className="text-sm text-red-700">
                        {errors.requirement}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label
                      htmlFor="message"
                      className="text-sm font-semibold text-ink"
                    >
                      Message <span aria-hidden="true" className="text-red-700">*</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      placeholder="Tell us what you are looking for..."
                      required
                      aria-invalid={Boolean(errors.message)}
                      aria-describedby={errors.message ? "message-error" : undefined}
                      className={`${inputClasses} resize-y`}
                    />
                    {errors.message && (
                      <p id="message-error" className="text-sm text-red-700">
                        {errors.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={submitting}
                  >
                    {submitting ? "Sending..." : "Send Inquiry"}
                    <ArrowRight size={18} weight="bold" aria-hidden="true" />
                  </Button>
                  <p className="flex items-center gap-2 text-sm text-forest-800">
                    <Phone size={16} weight="fill" aria-hidden="true" />
                    Prefer to talk? Call us at{" "}
                    <a
                      href={BUSINESS.phoneHref}
                      className="font-semibold text-forest-700 underline-offset-4 hover:underline"
                    >
                      {BUSINESS.phone}
                    </a>
                  </p>
                </div>
              </form>
            </>
          )}
        </Reveal>
      </div>
    </section>
  );
}
