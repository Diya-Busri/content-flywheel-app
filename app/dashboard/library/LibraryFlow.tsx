"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Search,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Download,
  Package,
  Video,
  FileText,
  ImageIcon,
  ExternalLink,
  Loader2,
  RotateCcw,
  Trash,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type LibraryTab = "products" | "videos" | "scripts" | "all" | "trash";

type LibraryItem = {
  id: string;
  type: "product" | "video" | "script";
  title: string;
  thumbnail?: string;
  status: string;
  createdAt: string;
  productId?: string;
  videoId?: string;
  scriptId?: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    draft: "Draft",
    published: "Published",
    "needs_review": "Needs review",
  };
  return m[s] ?? s;
}

function typeIcon(type: string) {
  switch (type) {
    case "product":
      return <Package className="w-5 h-5 text-orange-500" />;
    case "video":
      return <Video className="w-5 h-5 text-blue-500" />;
    case "script":
      return <FileText className="w-5 h-5 text-green-500" />;
    default:
      return <ImageIcon className="w-5 h-5 text-slate-500" />;
  }
}

export default function LibraryFlow() {
  const [tab, setTab] = useState<LibraryTab>("all");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const fetchItems = async () => {
    setLoading(true);
    try {
      const isTrash = tab === "trash";
      const typeParam = isTrash ? "all" : tab === "all" ? "all" : tab;
      const url = isTrash
        ? `/api/library?type=all&deleted=true`
        : `/api/library?type=${typeParam}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load library");
      const data = await res.json();
      setItems(data ?? []);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load library", variant: "destructive" });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [tab]);

  const filtered = items.filter((item) =>
    search.trim() ? item.title.toLowerCase().includes(search.toLowerCase()) : true
  );

  const getEditLink = (item: LibraryItem) => {
    if (item.type === "product") return `/dashboard/digital-products/${item.id}/edit`;
    if (item.type === "video") return `/dashboard/library`;
    if (item.type === "script") return `/dashboard/script-checker`;
    return "#";
  };

  const isTrashView = tab === "trash";

  const handleDelete = async (item: LibraryItem, permanent = false) => {
    const message = permanent
      ? `Permanently delete "${item.title}"? This cannot be undone.`
      : `Move "${item.title}" to Trash? You can restore it later.`;
    if (!confirm(message)) return;
    try {
      let url = "";
      if (item.type === "product") url = `/api/products/${item.id}`;
      if (item.type === "video") url = `/api/library/videos/${item.id}`;
      if (item.type === "script") url = `/api/library/scripts/${item.id}`;
      if (!url) return;
      if (permanent) url += "?permanent=true";
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: permanent ? "Permanently deleted" : "Moved to Trash" });
      fetchItems();
    } catch (err) {
      toast({ title: "Error", description: "Could not delete", variant: "destructive" });
    }
  };

  const handleRestore = async (item: LibraryItem) => {
    try {
      let url = "";
      let method = "POST";
      if (item.type === "product") url = `/api/products/${item.id}`;
      if (item.type === "video") url = `/api/library/videos/${item.id}`;
      if (item.type === "script") url = `/api/library/scripts/${item.id}`;
      if (!url) return;
      const res = await fetch(url, { method });
      if (!res.ok) throw new Error("Failed to restore");
      toast({ title: "Restored", description: `"${item.title}" is back in your library.` });
      fetchItems();
    } catch (err) {
      toast({ title: "Error", description: "Could not restore", variant: "destructive" });
    }
  };

  return (
    <main className="p-6 md:p-10 max-w-5xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      <h1 className="text-3xl font-bold text-white mb-2">My Library</h1>
      <p className="text-gray-400 mb-8">
        Your digital products, videos, and scripts in one place
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as LibraryTab)}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <TabsList className="bg-[#1A1A1A] border border-[#2A2A2A]">
            <TabsTrigger value="all" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">All items</TabsTrigger>
            <TabsTrigger value="products" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">Digital Products</TabsTrigger>
            <TabsTrigger value="videos" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">Videos</TabsTrigger>
            <TabsTrigger value="scripts" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">Scripts</TabsTrigger>
            <TabsTrigger value="trash" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">Trash</TabsTrigger>
          </TabsList>
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-gray-500"
            />
          </div>
        </div>

        <TabsContent value={tab} className="mt-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
              <p className="text-gray-400">Loading library...</p>
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
              <CardContent className="py-12 text-center">
                {isTrashView ? (
                  <>
                    <Trash className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2">Trash is empty</p>
                    <p className="text-sm text-gray-500">
                      Deleted items appear here. Restore them or delete permanently.
                    </p>
                  </>
                ) : (
                  <>
                    <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2">No items yet</p>
                    <p className="text-sm text-gray-500">
                      Save products from Digital Products, scripts from Script Checker, and videos from TikTok Shop.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => (
                <Card key={`${item.type}-${item.id}`} className="border-[#2A2A2A] bg-[#1A1A1A] overflow-hidden">
                  <div className="aspect-video bg-[#2A2A2A] flex items-center justify-center">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      typeIcon(item.type)
                    )}
                  </div>
                  <CardHeader className="pb-2 pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base truncate text-white">{item.title}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!isTrashView && (
                            <>
                              <DropdownMenuItem asChild>
                                <Link href={getEditLink(item)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              {item.type === "product" && (
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/digital-products/scripts?productId=${encodeURIComponent(item.id)}`}>
                                    <Video className="w-4 h-4 mr-2" />
                                    Create Videos
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(item.title)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 dark:text-red-400"
                                onClick={() => handleDelete(item, false)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Move to Trash
                              </DropdownMenuItem>
                            </>
                          )}
                          {isTrashView && (
                            <>
                              <DropdownMenuItem onClick={() => handleRestore(item)}>
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Restore
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 dark:text-red-400"
                                onClick={() => handleDelete(item, true)}
                              >
                                <Trash className="w-4 h-4 mr-2" />
                                Delete permanently
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription className="text-xs">
                      {formatDate(item.createdAt)} • {statusLabel(item.status)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 flex gap-2">
                    {isTrashView ? (
                      <>
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => handleRestore(item)}>
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restore
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                          onClick={() => handleDelete(item, true)}
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" className="flex-1" asChild>
                          <Link href={getEditLink(item)}>
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            Open
                          </Link>
                        </Button>
                        {item.type === "product" && (
                          <Button variant="outline" size="sm" asChild title="Create Videos">
                            <Link href={`/dashboard/digital-products/scripts?productId=${encodeURIComponent(item.id)}`}>
                              <Video className="w-3.5 h-3.5" />
                            </Link>
                          </Button>
                        )}
                        <Button variant="outline" size="sm">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
