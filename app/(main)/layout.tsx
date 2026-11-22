import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { NavIconLinks, NavIcons } from "@/components/nav-icons";
import sunflower from "@/app/icon.png";

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
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-serif text-xl">
            <Image src={sunflower} alt="" width={28} height={28} priority />
            Memories
          </Link>
          <div className="flex items-center gap-1">
            <Suspense fallback={<NavIconLinks pathname="" />}>
              <NavIcons />
            </Suspense>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <LogoutButton />
          </div>
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
