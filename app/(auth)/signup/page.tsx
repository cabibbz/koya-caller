/**
 * Signup Page
 * 
 * Spec Reference: Part 4, Lines 170-176 (Account Creation)
 * - Click "Get Started Free"
 * - Email, Password, Business name, Phone number
 */

import { Metadata } from "next";
import { SignupForm } from "@/components/auth";

export const metadata: Metadata = {
  title: "Sign Up | Koya",
  description: "Create your Koya account and set up your AI receptionist.",
};

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-2 text-muted-foreground">
          Set up your AI receptionist in minutes
        </p>
      </div>

      <SignupForm />
    </div>
  );
}
