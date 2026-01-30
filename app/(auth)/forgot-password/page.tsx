/**
 * Forgot Password Page
 */

import { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth";

export const metadata: Metadata = {
  title: "Forgot Password | Koya",
  description: "Reset your Koya account password.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
