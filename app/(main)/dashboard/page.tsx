import { Plus } from "lucide-react";

export default function DashboardPage() {
  return (
    <section>
      <div className="flex items-end justify-between">
        <h1 className="font-serif text-4xl">Memories</h1>
        <button disabled className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground opacity-50">
          <Plus className="h-4 w-4" /> New Memory
        </button>
      </div>
      <p className="mt-24 text-center text-muted-foreground">No memories yet.</p>
    </section>
  );
}