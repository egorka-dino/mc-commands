type Props = {
  active?: "servers" | "templates";
};

const adminLinks = [
  { href: "/admin/servers", key: "servers", label: "Серверы Exaroton" },
  { href: "/admin/templates", key: "templates", label: "Шаблоны мобов" },
] as const;

export function AdminNav({ active }: Props) {
  return (
    <section className="admin-section-nav" aria-label="Разделы админки">
      {adminLinks.map((link) => (
        <a
          aria-current={active === link.key ? "page" : undefined}
          className={active === link.key ? "active" : ""}
          href={link.href}
          key={link.key}
        >
          {link.label}
        </a>
      ))}
    </section>
  );
}
