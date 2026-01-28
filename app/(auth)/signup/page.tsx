/**
 * Signup Page
 * Server component with metadata for SEO
 *
 * Spec Reference: Part 4, Lines 170-176 (Account Creation)
 * - Click "Get Started Free"
 * - Email, Password, Business name, Phone number
 */

import { Metadata } from "next";
import { SignupPageClient } from "./signup-client";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create your Koya Caller account and get an AI phone receptionist for your business. 14-day free trial, no credit card required.",
  openGraph: {
    title: "Sign Up | Koya Caller",
    description: "Create your Koya Caller account and get an AI phone receptionist for your business.",
  },
  keywords: ["AI receptionist", "phone answering service", "business phone", "automated calls"],
};

export default function SignupPage() {
  return <SignupPageClient />;
}
