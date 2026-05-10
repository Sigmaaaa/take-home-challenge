import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, History, Database, User, Wand2, Trash2 } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useStore, storeActions } from "@/lib/store";
import { supabase, callFn } from "@/lib/supabase";
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

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/history", label: "History", icon: History },
] as const;

interface CorpusRow {
  id: string;
  name: string;
  source_type: string | null;
  created_at: string | null;
}

export function AppSidebar() {
  const { activeCorpusId } = useStore();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pending, setPending] = useState<CorpusRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: corpora = [] } = useQuery<CorpusRow[]>({
    queryKey: ["corpora"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corpora")
        .select("id, name, source_type, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CorpusRow[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (corpus_id: string) => {
      await callFn("delete-corpus", { corpus_id });
      return corpus_id;
    },
    onSuccess: (corpus_id) => {
      qc.setQueryData<CorpusRow[]>(["corpora"], (prev) =>
        (prev ?? []).filter((r) => r.id !== corpus_id),
      );
      if (activeCorpusId === corpus_id) {
        storeActions.setActiveCorpus(null);
        navigate({ to: "/" });
      }
      setPending(null);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <aside className="w-[240px] shrink-0 border-r border-border bg-background flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-border flex items-center gap-2">
        <span className="size-2 rounded-full bg-indigo" />
        <span className="text-sm small-caps text-text-primary font-medium">Tone &amp; Style</span>
      </div>

      <nav className="px-2 py-3 flex flex-col gap-0.5">
        {nav.map((item) => {
          const active = path === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-2.5 px-3 py-1.5 text-sm rounded-sm transition-colors ${
                active
                  ? "bg-surface-elevated text-text-primary"
                  : "text-text-secondary hover:bg-surface hover:text-text-primary"
              }`}
            >
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 mt-2">
        <div className="text-[10px] small-caps text-text-muted mb-2">Corpora</div>
      </div>
      <div className="px-2 flex-1 overflow-y-auto scrollbar-thin">
        {corpora.length === 0 && (
          <div className="px-3 text-xs text-text-muted">No corpora yet</div>
        )}
        {corpora.map((c) => {
          const active = c.id === activeCorpusId;
          return (
            <div key={c.id} className={`group/corpus mb-1 rounded-sm border-l-2 ${active ? "border-l-indigo bg-surface" : "border-l-transparent"}`}>
              <div className="relative">
                <button
                  onClick={() => {
                    storeActions.setActiveCorpus(c.id);
                    navigate({ to: "/profile" });
                  }}
                  className={`w-full text-left px-3 py-2 pr-8 text-xs transition-colors rounded-sm ${
                    active ? "text-text-primary" : "text-text-secondary hover:bg-surface hover:text-text-primary"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Database className="size-3 shrink-0 opacity-60" />
                    <span className="truncate flex-1">{c.name}</span>
                  </div>
                  <div className="mt-1 ml-5 flex items-center gap-2">
                    {c.source_type && (
                      <span className="inline-block text-[9px] small-caps px-1.5 py-0.5 border border-border rounded-sm text-text-muted">
                        {c.source_type}
                      </span>
                    )}
                    {c.created_at && (
                      <span className="text-[10px] text-text-muted font-mono">
                        {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setError(null);
                    setPending(c);
                  }}
                  aria-label="Delete corpus"
                  className="absolute top-2 right-2 p-1 rounded-sm text-text-muted opacity-0 group-hover/corpus:opacity-100 hover:text-danger hover:bg-surface-elevated transition-opacity"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
              {active && (
                <div className="px-3 pb-2 ml-5 flex flex-col gap-0.5">
                  <Link
                    to="/profile"
                    className={`flex items-center gap-2 px-2 py-1 text-[11px] rounded-sm transition-colors ${
                      path === "/profile" ? "bg-surface-elevated text-text-primary" : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
                    }`}
                  >
                    <User className="size-3" /> Profile
                  </Link>
                  <Link
                    to="/generate"
                    className={`flex items-center gap-2 px-2 py-1 text-[11px] rounded-sm transition-colors ${
                      path === "/generate" ? "bg-surface-elevated text-text-primary" : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
                    }`}
                  >
                    <Wand2 className="size-3" /> Generate
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-border">
        <span className="text-[10px] font-mono text-text-muted">v0.1.0 · build a3f</span>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && !deleteMut.isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this corpus and all its generations?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? `"${pending.name}" and its style profile, generations, and scores will be permanently removed.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <div className="border border-danger/50 bg-danger/10 text-danger text-xs px-3 py-2 rounded-sm font-mono">
              {error}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pending) deleteMut.mutate(pending.id);
              }}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
