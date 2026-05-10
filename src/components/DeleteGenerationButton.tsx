import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { callFn } from "@/lib/supabase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  generationId: string;
  className?: string;
}

export function DeleteGenerationButton({ generationId, className }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      await callFn("delete-generation", { generation_id: generationId });
    },
    onSuccess: () => {
      qc.setQueryData<any[]>(["history"], (prev) =>
        (prev ?? []).filter((r) => r.id !== generationId),
      );
      setOpen(false);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setError(null);
          setOpen(true);
        }}
        aria-label="Delete generation"
        className={
          className ??
          "p-1 rounded-sm text-text-muted hover:text-danger hover:bg-surface-elevated transition-colors"
        }
      >
        <Trash2 className="size-3.5" />
      </button>

      <AlertDialog open={open} onOpenChange={(o) => !mut.isPending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this generation?</AlertDialogTitle>
            <AlertDialogDescription>
              This generation and its score will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <div className="border border-danger/50 bg-danger/10 text-danger text-xs px-3 py-2 rounded-sm font-mono">
              {error}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={mut.isPending}
              onClick={(e) => {
                e.preventDefault();
                mut.mutate();
              }}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {mut.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
