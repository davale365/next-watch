import Link from "next/link";

const LINKS = [
  { href: "/", label: "Watches" },
  { href: "/picks", label: "Picks" },
  { href: "/watchlist", label: "Watchlist" },
];

export function TopNav() {
  return (
    <nav className="border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-widest"
        >
          Next Watch
        </Link>
        <ul className="flex items-center gap-4 text-sm text-muted-foreground">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="transition hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
