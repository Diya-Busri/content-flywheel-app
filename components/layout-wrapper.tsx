"use client";

/**
 * Layout Wrapper component for Template App
 * Controls when to show the header based on the current URL path
 * Prevents header from appearing on dashboard pages
 */
import { ReactNode } from "react";

interface LayoutWrapperProps {
  children: ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  return (
    <>
      <main>
        {children}
      </main>
    </>
  );
} 