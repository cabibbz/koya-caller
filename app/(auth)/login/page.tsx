/**
 * Login Page
 * Server component with metadata for SEO
 */

import { Metadata } from "next";
import { LoginPageClient } from "./login-client";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your Koya Caller account to manage your AI phone receptionist, view call analytics, and handle appointments.",
  openGraph: {
    title: "Log In | Koya Caller",
    description: "Log in to your Koya Caller account to manage your AI phone receptionist.",
  },
  robots: {
    index: false, // Don't index login pages
    follow: true,
  },
};

export default function LoginPage() {
  return <LoginPageClient />;
}
