"use client";

import React, { createContext, useContext } from "react";

const WorkspaceAdminContext = createContext<boolean>(false);

export function WorkspaceAdminProvider({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceAdminContext.Provider value={isAdmin}>
      {children}
    </WorkspaceAdminContext.Provider>
  );
}

export function useWorkspaceAdmin(): boolean {
  return useContext(WorkspaceAdminContext);
}
