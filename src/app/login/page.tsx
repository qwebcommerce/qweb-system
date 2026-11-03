import type { Metadata } from "next";
import { LoginScreen } from "@/components/auth/login-screen";
import { PublicFrame } from "@/components/layout/public-frame";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <PublicFrame>
      <LoginScreen />
    </PublicFrame>
  );
}
