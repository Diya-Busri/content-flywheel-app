import type { ProductDetails } from "./types";

export interface NotionTemplateResult {
  markdown: string;
  csv: string;
  instructions: string;
}

export async function generateNotionTemplate(details: ProductDetails): Promise<NotionTemplateResult> {
  const title = details.title || "Template";
  const description = details.description || "A Notion template to get you started.";

  const markdown = `
# ${title}

## Overview
${description}

## Database Structure

### Tasks Database
- [ ] Set up your workspace
- [ ] Import this template
- [ ] Customize properties
- [ ] Add your first entry

### Properties
| Property | Type | Description |
|----------|------|-------------|
| Name | Title | Task name |
| Status | Select | Not started, In progress, Complete |
| Priority | Select | Low, Medium, High |
| Due Date | Date | Deadline |
| Category | Multi-select | Tags for organization |

## Quick Start Guide

1. **Duplicate this template** to your Notion workspace
2. **Customize the properties** to match your needs
3. **Add your first entries** to get started
4. **Set up views** (Board, Calendar, List)

## Sample Entries

Add these examples to get started:
- Example task 1
- Example task 2
- Example task 3

---

📌 **Pro Tip:** Pin frequently used databases to your sidebar
`.trim();

  const csv = `Name,Status,Priority,Due Date,Category
"Set up workspace","Not started","High","2024-02-15","Setup"
"Import template","Not started","High","2024-02-15","Setup"
"Customize properties","Not started","Medium","2024-02-16","Configuration"
"Add first entry","Not started","Low","2024-02-17","Usage"`;

  const instructions = `To import this template into Notion:
1. Create a new page in Notion
2. Type /import and select "Markdown"
3. Upload the .md file
4. For the database, type /table and import the .csv file`;

  return { markdown, csv, instructions };
}
