import type { Metadata } from "next";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { AuthShell } from "../../components/auth/auth-shell";
import { RegisterForm } from "../../components/auth/register-form";

export const metadata: Metadata = {
  title: "Create Account | Jay Hari Krushi Seva Kendra",
};

export default function RegisterPage() {
  return (
    <>
      <div id="page-top-sentinel" aria-hidden="true" />
      <Header />
      <main className="pt-16 lg:pt-20">
        <AuthShell>
          <RegisterForm />
        </AuthShell>
      </main>
      <Footer />
    </>
  );
}