import Link from "next/link";
import * as React from "react";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        {items.map((c, i) => (
          <li key={c.label} className="flex items-center gap-1.5">
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} className="rounded-sm transition-colors hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground/80" aria-current={i === items.length - 1 ? "page" : undefined}>
                {c.label}
              </span>
            )}
            {i < items.length - 1 && <ChevronRight className="h-3 w-3 text-muted/40" aria-hidden />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-border/50 pb-6">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
            {title}
          </h1>
          {description && (
            <p className="max-w-3xl text-xs md:text-sm text-muted leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
      </div>
    </header>
  );
}
