import { notFound } from "next/navigation";
import { db } from "@/db/db";
import { bioPagesTable } from "@/db/schema/bio-page-schema";
import { eq } from "drizzle-orm";
import WaitlistForm from "./WaitlistForm";
import type { Metadata } from "next";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [page] = await db
    .select({ title: bioPagesTable.title, bio: bioPagesTable.bio })
    .from(bioPagesTable)
    .where(eq(bioPagesTable.slug, params.slug));

  if (!page) return { title: "Page not found" };
  return {
    title: page.title || params.slug,
    description: page.bio || undefined,
  };
}

export default async function BioPublicPage({ params }: Props) {
  const [page] = await db
    .select()
    .from(bioPagesTable)
    .where(eq(bioPagesTable.slug, params.slug));

  if (!page || !page.isPublished) notFound();

  let links: { label: string; url: string }[] = [];
  try { links = JSON.parse(page.links); } catch { /* empty */ }

  const initials = page.title ? page.title.slice(0, 2).toUpperCase() : page.slug.slice(0, 2).toUpperCase();
  const color = page.primaryColor ?? "#f97316";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start py-12 px-4"
      style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #111111 100%)" }}
    >
      {/* Top colour bar */}
      <div
        className="fixed top-0 left-0 right-0 h-1"
        style={{ backgroundColor: color }}
      />

      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Avatar */}
        {page.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.avatarUrl}
            alt={page.title}
            className="w-24 h-24 rounded-full object-cover mb-5 ring-2 ring-white/10"
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-5"
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
        )}

        {/* Title */}
        {page.title && (
          <h1 className="text-2xl font-bold text-white mb-1 text-center">{page.title}</h1>
        )}

        {/* Bio */}
        {page.bio && (
          <p className="text-sm text-gray-400 mb-8 text-center leading-relaxed max-w-xs">
            {page.bio}
          </p>
        )}

        {/* Links */}
        {links.length > 0 && (
          <div className="w-full space-y-3 mb-8">
            {links.map((link, i) =>
              link.url ? (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3.5 px-5 rounded-2xl text-sm font-semibold text-center text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: color }}
                >
                  {link.label || link.url}
                </a>
              ) : null
            )}
          </div>
        )}

        {/* Waitlist */}
        {page.showWaitlist && (
          <div className="w-full mt-4 pt-6 border-t border-white/10">
            <WaitlistForm
              slug={page.slug}
              cta={page.waitlistCta}
              primaryColor={color}
            />
          </div>
        )}

        {/* Footer */}
        <p className="mt-12 text-[11px] text-gray-700">
          Powered by{" "}
          <a href="https://contentflywheel.com" className="hover:text-gray-500 transition-colors">
            Content Flywheel
          </a>
        </p>
      </div>
    </div>
  );
}
