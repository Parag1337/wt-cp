import type { Metadata } from "next";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import AccountRedirect from "./account-redirect";

export const metadata: Metadata = {
  title: "My Account | Jay Hari Krushi Seva Kendra",
};

export default function AccountPage() {
  return (
    <>
      <div id="page-top-sentinel" aria-hidden="true" />
      <Header />
      <main className="pt-16 lg:pt-20">
        <AccountRedirect />
      </main>
      <Footer />
    </>
  );
}
