import type { Metadata } from "next";
import { CustomerLayout } from "../../components/customer-layout";
import ProfileContent from "./profile-content";

export const metadata: Metadata = {
  title: "My Profile | Jay Hari Krushi Seva Kendra",
  description: "View and manage your customer profile.",
};

export default function ProfilePage() {
  return (
    <CustomerLayout>
      <ProfileContent />
    </CustomerLayout>
  );
}
