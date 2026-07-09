export type BestVideoRow = {
  id: string;
  title: string;
  platform: string;
  views: number;
  engagement: string;
};

export type PerVideoRow = BestVideoRow & {
  ctr: string;
  avd: string;
  retentionCurve: number[];
  trafficSources: { source: string; pct: number }[];
  demographics: { age: string; pct: number }[];
};

export function derivePerVideoRows(bestVideos: BestVideoRow[]): PerVideoRow[] {
  const sources = [
    { source: "Browse", pct: 45 },
    { source: "Search", pct: 28 },
    { source: "Suggested", pct: 18 },
    { source: "External", pct: 9 },
  ];
  const ages = [
    { age: "18–24", pct: 32 },
    { age: "25–34", pct: 41 },
    { age: "35–44", pct: 18 },
    { age: "45+", pct: 9 },
  ];
  return bestVideos.slice(0, 10).map((v, i) => {
    const trafficSources = sources.map((s) => {
      const pct = Math.max(5, s.pct + (i % 3) * 2 - 2);
      return { ...s, pct };
    });
    return {
      ...v,
      ctr: `${(4.2 + i * 0.3).toFixed(1)}%`,
      avd: `${Math.round(45 + i * 8)}%`,
      retentionCurve: [100, 78, 62, 51, 44, 38, 34, 31, 28, 26].map((p) => p - i * 2),
      trafficSources,
      demographics: ages,
    };
  });
}
