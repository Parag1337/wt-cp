import type { Metadata } from "next";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { AuthShell } from "../../components/auth/auth-shell";
import { LoginForm } from "../../components/auth/login-form";

export const metadata: Metadata = {
  title: "Login | Jay Hari Krushi Seva Kendra",
};

export default function LoginPage() {
  return (
    <>
      <div id="page-top-sentinel" aria-hidden="true" />
      <Header />
      <main className="pt-16 lg:pt-20">
        <AuthShell>
          <LoginForm />
        </AuthShell>
      </main>
      <Footer />
    </>
  );
}