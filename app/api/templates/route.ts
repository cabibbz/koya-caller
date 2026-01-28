/**
 * Industry Templates API
 * Returns pre-configured templates for different business types
 */

import { NextResponse } from "next/server";
import { industryTemplates, getTemplateById } from "@/lib/templates/industry-templates";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get("id");

  if (templateId) {
    // Return specific template
    const template = getTemplateById(templateId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ template });
  }

  // Return all templates (summary)
  const templates = industryTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    icon: t.icon,
    description: t.description,
  }));

  return NextResponse.json({ templates });
}
