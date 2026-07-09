"use client";

import React from "react";
import { DesignData, DesignElement } from "@/db/schema/designs-schema";

function buildBg(data: DesignData): string {
  if (data.backgroundType === "gradient" && data.backgroundGradient) {
    const { color1, color2, angle } = data.backgroundGradient;
    return `linear-gradient(${angle}deg, ${color1}, ${color2})`;
  }
  return data.background;
}

function PreviewElement({ el, scale }: { el: DesignElement; scale: number }) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: el.x * scale,
    top: el.y * scale,
    width: el.width * scale,
    height: el.height * scale,
    opacity: el.opacity ?? 1,
    transform: `rotate(${el.rotation ?? 0}deg)`,
    transformOrigin: "center center",
    zIndex: el.zIndex ?? 0,
    overflow: "hidden",
    pointerEvents: "none",
  };

  if (el.type === "text") {
    // Use overflow:visible so text that fills the element box isn't clipped in preview thumbnails.
    // The canvas container (SlidePreview root) provides the hard outer clip.
    const textStyle: React.CSSProperties = { ...style, overflow: "visible" };
    return (
      <div style={textStyle}>
        {(() => {
          const lineClamp = el.autoFit && el.autoFit !== "auto" && el.autoFit !== "unlimited"
            ? parseInt(el.autoFit, 10)
            : (el.lineClamp ?? 0);
          const clampStyle: React.CSSProperties = lineClamp > 0
            ? { display: "-webkit-box", WebkitLineClamp: lineClamp, WebkitBoxOrient: "vertical" as const, overflow: "hidden", whiteSpace: "normal" }
            : { whiteSpace: "pre-wrap", overflow: "visible" };
          const baseStyle: React.CSSProperties = {
            width: "100%",
            background: el.textBackground ?? "transparent",
            fontFamily: el.fontFamily ?? "Inter",
            fontSize: (el.fontSize ?? 32) * scale,
            color: el.color ?? "#1a1a1a",
            fontWeight: el.fontWeight ?? "normal",
            fontStyle: el.fontStyle ?? "normal",
            textDecoration: el.textDecoration,
            textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "left",
            lineHeight: el.lineHeight ?? 1.3,
            letterSpacing: `${(el.letterSpacing ?? 0) * scale}px`,
            wordBreak: "break-word",
            overflowWrap: "break-word",
            padding: el.textBackground ? `${28 * scale}px ${40 * scale}px` : undefined,
            boxSizing: "border-box",
            borderRadius: el.textBackground ? 16 * scale : undefined,
            ...(el.balanceLines ? { textWrap: "balance" } as React.CSSProperties : {}),
            ...clampStyle,
          };
          // Render with paragraph spacing if set
          if (el.paragraphSpacing && el.paragraphSpacing > 0 && lineClamp === 0) {
            const paras = (el.content ?? "").split(/\n\n/);
            return (
              <div style={baseStyle}>
                {paras.map((para, i) => (
                  <React.Fragment key={i}>
                    <span style={{ display: "block" }}>{para}</span>
                    {i < paras.length - 1 && (
                      <span style={{ display: "block", height: el.paragraphSpacing! * scale }} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            );
          }
          return <div style={baseStyle}>{el.content}</div>;
        })()}
      </div>
    );
  }

  if (el.type === "image") {
    return (
      <div style={style}>
        {el.imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={el.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: (el.objectFit as "cover" | "contain") ?? "cover", display: "block" }} draggable={false} />
          : <div style={{ width: "100%", height: "100%", background: "#e5e7eb" }} />}
      </div>
    );
  }

  // Shape
  return (
    <div style={{
      ...style,
      background: el.fill ?? "#f97316",
      borderRadius: (el.borderRadius ?? 0) * scale,
    }} />
  );
}

export function SlidePreview({ data, scale }: { data: DesignData; scale: number }) {
  return (
    <div
      style={{
        width: data.width * scale,
        height: data.height * scale,
        background: buildBg(data),
        backgroundImage: data.backgroundImage ? `url(${data.backgroundImage})` : undefined,
        backgroundSize: data.backgroundImageFit ?? "cover",
        backgroundPosition: "center",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {data.backgroundImage && (data.backgroundImageBlur ?? 0) > 0 && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${data.backgroundImage})`,
          backgroundSize: data.backgroundImageFit ?? "cover",
          backgroundPosition: "center",
          filter: `blur(${data.backgroundImageBlur}px)`,
          transform: "scale(1.06)",
          transformOrigin: "center",
          zIndex: 0,
          pointerEvents: "none",
        }} />
      )}
      {[...data.elements]
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
        .map((el) => <PreviewElement key={el.id} el={el} scale={scale} />)}
    </div>
  );
}
