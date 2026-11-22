"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Settings, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/favorites", label: "Favorites", Icon: Star },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/settings", label: "Settings", Icon: Settings },
];

/** Reads the URL to highlight the current page; render inside <Suspense>. */
export function NavIcons() {
  return <NavIconLinks pathname={usePathname()} />;
}

/** Same links without the highlight; used as the Suspense fallback. */
export function NavIconLinks({ pathname }: { pathname: string }) {
  return (
    <>
      {items.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              active && "bg-primary text-primary-foreground",
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </Link>
        );
      })}
    </>
  );
}
