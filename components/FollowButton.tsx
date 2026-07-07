"use client";

import { useState, useEffect } from "react";

interface Props {
  creatorId: string;
  initialFollowerCount: number;
  accentColor?: string;
}

export default function FollowButton({ creatorId, initialFollowerCount, accentColor = "#f97316" }: Props) {
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Check if the current user already follows this creator
  useEffect(() => {
    fetch(`/api/marketplace/follow?creatorId=${creatorId}`)
      .then((r) => r.json())
      .then((d) => {
        setFollowing(d.following ?? false);
        setFollowerCount(d.followerCount ?? initialFollowerCount);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [creatorId, initialFollowerCount]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const wasFollowing = following;
    // Optimistic update
    setFollowing(!wasFollowing);
    setFollowerCount((c) => wasFollowing ? c - 1 : c + 1);

    try {
      const res = await fetch(
        wasFollowing
          ? `/api/marketplace/follow?creatorId=${creatorId}`
          : `/api/marketplace/follow`,
        wasFollowing
          ? { method: "DELETE" }
          : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creatorId }) }
      );
      if (res.status === 401) {
        // Not signed in — revert and redirect
        setFollowing(wasFollowing);
        setFollowerCount((c) => wasFollowing ? c + 1 : c - 1);
        window.location.href = "/login";
        return;
      }
      const d = await res.json();
      if (d.followerCount !== undefined) setFollowerCount(d.followerCount);
    } catch {
      // Revert on error
      setFollowing(wasFollowing);
      setFollowerCount((c) => wasFollowing ? c + 1 : c - 1);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 20px", borderRadius: "100px", background: "rgba(0,0,0,0.06)", minWidth: "100px" }} />
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        padding: "10px 22px",
        borderRadius: "100px",
        border: following ? `2px solid ${accentColor}` : "2px solid transparent",
        background: following ? "transparent" : accentColor,
        color: following ? accentColor : "#fff",
        fontSize: "13px",
        fontWeight: 700,
        cursor: busy ? "wait" : "pointer",
        transition: "all 0.18s",
        letterSpacing: "-0.2px",
        boxShadow: following ? "none" : `0 4px 16px ${accentColor}55`,
        opacity: busy ? 0.7 : 1,
      }}
    >
      {following ? (
        <>
          <span style={{ fontSize: "14px" }}>✓</span> Following
          {followerCount > 0 && (
            <span style={{ background: `${accentColor}22`, color: accentColor, fontSize: "11px", padding: "1px 7px", borderRadius: "999px", fontWeight: 800 }}>
              {followerCount.toLocaleString()}
            </span>
          )}
        </>
      ) : (
        <>
          <span style={{ fontSize: "15px" }}>+</span> Follow
          {followerCount > 0 && (
            <span style={{ background: "rgba(255,255,255,0.25)", fontSize: "11px", padding: "1px 7px", borderRadius: "999px", fontWeight: 800 }}>
              {followerCount.toLocaleString()}
            </span>
          )}
        </>
      )}
    </button>
  );
}
