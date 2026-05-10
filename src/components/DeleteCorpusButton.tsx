import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { callFn } from "@/lib/supabase";
import { useStore, storeActions } from "@/lib/store";
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
  corpusId: string;
  corpusName: string;
  variant?: "icon" | "button";
  className?: string;
  iconClassName?: string;
}

export function DeleteCorpusButton({
  corpusId,
  corpusName,
  variant = "icon",
  className,
  iconClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { activeCorpusId } = useStore();

  const mut = useMutation({
    mutationFn: async () => {
      await callFn("delete-corpus", { corpus_id: corpusId });
    },
    onSuccess: () => {
      qc.setQueryData<any[]>(["corpora"], (prev) =>
        (prev ?? []).filter((r) => r.id !== corpusId),
      );
      qc.invalidateQueries({ queryKey: ["history"] });
      if (activeCorpusId === corpusId) {
        storeActions.setActiveCorpus(null);
        navigate({ to: "/" });
      }
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
        aria-label="Delete corpus"
        className={
          variant === "icon"
            ? className ??
              "p-1 rounded-sm text-text-muted hover:text-danger hover:bg-surface-elevated transition-colors"
            : className ??
              "inline-flex items-center gap-2 text-xs px-3 py-2 border border-border text-text-secondary hover:text-danger hover:border-danger/50 rounded-sm transition-colors"
        }
      >
        <Trash2 className={iconClassName ?? (variant === "icon" ? "size-3" : "size-3.5")} />
        {variant === "button" && <span>Delete corpus</span>}
      </button>

      <AlertDialog open={open} onOpenChange={(o) => !mut.isPending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this corpus and all its generations?</AlertDialogTitle>
            <AlertDialogDescription>
              "{corpusName}" and its style profile, generations, and scores will be permanently removed.
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
