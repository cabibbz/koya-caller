/**
 * Reset Password Page
 * User lands here after clicking reset link in email
 */

import { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth";

export const metadata: Metadata = {
  title: "Reset Password | Koya",
  description: "Set a new password for your Koya account.",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
