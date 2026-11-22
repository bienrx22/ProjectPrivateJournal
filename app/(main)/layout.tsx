import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

const nav = [
  { href: "/favorites", label: "Favorites" },
  { href: "/calendar", label: "Calendar" },
  { href: "/settings", label: "Settings" },
];

async function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/auth/login");
  return <>{children}</>;
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4 text-sm">
          <Link href="/dashboard" className="font-serif text-xl">Memories</Link>
          <div className="flex flex-1 gap-5 overflow-x-auto text-muted-foreground">
            {nav.map((i) => (
              <Link key={i.href} href={i.href} className="whitespace-nowrap transition-colors hover:text-foreground">
                {i.label}
              </Link>
            ))}
          </div>
          <LogoutButton />
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </main>
    </div>
  );
}