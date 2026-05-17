"use client";

import { usePathname } from "next/navigation";
import { AuthCorner } from "./AuthCorner";

const links = [
  { href: "/", label: "Командный хаб", exact: true },
  { href: "/summon", label: "/summon" },
  { href: "/give", label: "/give" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname() || "/";

  return (
    <nav className="site-topbar" aria-label="Основная навигация">
      <a className="site-brand" href="/">
        mc-commands
      </a>
      <div className="site-nav-links">
        {links.map((link) => (
          <a
            aria-current={isActive(pathname, link.href, link.exact) ? "page" : undefined}
            className={isActive(pathname, link.href, link.exact) ? "active" : ""}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </a>
        ))}
      </div>
      <AuthCorner currentPath={pathname} />
    </nav>
  );
}
