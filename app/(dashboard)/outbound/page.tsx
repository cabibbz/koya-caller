/**
 * Outbound Command Center
 * Unified page for campaigns, contacts, call history, and settings
 */

import { Metadata } from "next";
import { OutboundClient } from "./outbound-client";

export const metadata: Metadata = {
  title: "Outbound | Koya",
  description: "Manage outbound calling campaigns and contacts",
};

export const dynamic = "force-dynamic";

export default function OutboundPage() {
  return <OutboundClient />;
}
