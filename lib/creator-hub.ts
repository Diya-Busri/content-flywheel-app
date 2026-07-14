import { db } from "@/db/db";
import { profileSectionsTable, type SelectProfileSection } from "@/db/schema/creator-hub-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { eq, and, asc } from "drizzle-orm";

export type SectionType =
  | "featured_product"
  | "products"
  | "social_links"
  | "featured_content"
  | "newsletter"
  | "currently_building"
  | "custom";

export const SECTION_LABELS: Record<SectionType, string> = {
  featured_product: "Featured Product",
  products: "Store (Products)",
  social_links: "Social Links",
  featured_content: "Featured Content",
  newsletter: "Newsletter Signup",
  currently_building: "Currently Building",
  custom: "Custom Section",
};

export type FeaturedProductConfig = { productId: string | null };
export type FeaturedContentItem = { id: string; platform: "youtube" | "tiktok" | "instagram"; url: string; title?: string };
export type FeaturedContentConfig = { items: FeaturedContentItem[] };
export type NewsletterConfig = { headline?: string; subtext?: string };
export type CurrentlyBuildingConfig = { text: string };
export type CustomConfig = { title: string; body: string; links: { label: string; url: string }[] };

/**
 * Built-in blocks every creator starts with, in this order. "social_links"
 * inherits its initial visibility from the legacy storeSettings.showSocialLinks
 * flag so existing storefronts don't visually change on first load.
 */
async function defaultSectionSeeds(userId: string): Promise<{ type: SectionType; order: number; visible: boolean; config: Record<string, unknown> }[]> {
  const [settings] = await db
    .select({ showSocialLinks: storeSettingsTable.showSocialLinks })
    .from(storeSettingsTable)
    .where(eq(storeSettingsTable.userId, userId))
    .limit(1);

  return [
    { type: "featured_product", order: 0, visible: false, config: { productId: null } },
    { type: "products", order: 1, visible: true, config: {} },
    { type: "social_links", order: 2, visible: !!settings?.showSocialLinks, config: {} },
    { type: "featured_content", order: 3, visible: false, config: { items: [] } },
    { type: "newsletter", order: 4, visible: true, config: {} },
    { type: "currently_building", order: 5, visible: false, config: { text: "" } },
  ];
}

/** Fetch a creator's sections, seeding the built-in defaults on first access. */
export async function getOrSeedSections(userId: string): Promise<SelectProfileSection[]> {
  const existing = await db
    .select()
    .from(profileSectionsTable)
    .where(eq(profileSectionsTable.userId, userId))
    .orderBy(asc(profileSectionsTable.order));

  if (existing.length > 0) return existing;

  const seeds = await defaultSectionSeeds(userId);
  const inserted = await db
    .insert(profileSectionsTable)
    .values(seeds.map((s) => ({ userId, ...s })))
    .returning();

  return inserted.sort((a, b) => a.order - b.order);
}

/** Public-page helper: only visible sections, in order. Does not seed (read-only, fast path). */
export async function getVisibleSections(userId: string): Promise<SelectProfileSection[]> {
  const rows = await db
    .select()
    .from(profileSectionsTable)
    .where(eq(profileSectionsTable.userId, userId))
    .orderBy(asc(profileSectionsTable.order));

  // If nothing has been seeded yet (brand-new creator who's never opened the
  // dashboard builder), fall back to the same defaults so the page still
  // renders the store block rather than nothing.
  if (rows.length === 0) {
    const seeds = await defaultSectionSeeds(userId);
    return seeds
      .filter((s) => s.visible)
      .map((s, i) => ({
        id: `default-${i}`,
        userId,
        type: s.type,
        order: s.order,
        visible: s.visible,
        config: s.config,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
  }

  return rows.filter((r) => r.visible);
}

export async function reorderSections(userId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(profileSectionsTable)
        .set({ order: index, updatedAt: new Date() })
        .where(and(eq(profileSectionsTable.id, id), eq(profileSectionsTable.userId, userId)))
    )
  );
}

export async function updateSection(
  userId: string,
  id: string,
  patch: { visible?: boolean; config?: Record<string, unknown> }
): Promise<void> {
  await db
    .update(profileSectionsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(profileSectionsTable.id, id), eq(profileSectionsTable.userId, userId)));
}

export async function addCustomSection(userId: string): Promise<SelectProfileSection> {
  const existing = await db
    .select({ order: profileSectionsTable.order })
    .from(profileSectionsTable)
    .where(eq(profileSectionsTable.userId, userId))
    .orderBy(asc(profileSectionsTable.order));

  const nextOrder = existing.length > 0 ? Math.max(...existing.map((e) => e.order)) + 1 : 0;
  const config: CustomConfig = { title: "New section", body: "", links: [] };

  const [row] = await db
    .insert(profileSectionsTable)
    .values({ userId, type: "custom", order: nextOrder, visible: true, config })
    .returning();

  return row;
}

/** Only "custom" sections can be deleted — built-in blocks are hidden, not removed. */
export async function deleteCustomSection(userId: string, id: string): Promise<{ ok: boolean; error?: string }> {
  const [row] = await db
    .select()
    .from(profileSectionsTable)
    .where(and(eq(profileSectionsTable.id, id), eq(profileSectionsTable.userId, userId)))
    .limit(1);

  if (!row) return { ok: false, error: "Section not found" };
  if (row.type !== "custom") return { ok: false, error: "Only custom sections can be deleted — hide built-in blocks instead" };

  await db.delete(profileSectionsTable).where(and(eq(profileSectionsTable.id, id), eq(profileSectionsTable.userId, userId)));
  return { ok: true };
}
