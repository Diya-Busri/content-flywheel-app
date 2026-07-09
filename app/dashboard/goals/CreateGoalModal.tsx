"use client";

import CreateGoalDialog from "./CreateGoalDialog";

type CreateGoalModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (goalId: string) => void;
};

/** Placeholder wrapper for Create Goal modal. Uses CreateGoalDialog for now. */
export default function CreateGoalModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateGoalModalProps) {
  return (
    <CreateGoalDialog open={open} onOpenChange={onOpenChange} onSuccess={onSuccess} />
  );
}
