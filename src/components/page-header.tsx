import type { ReactNode } from "react";

/** Consistent page header: overline, title, description, right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
  overline,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  overline?: string;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {overline && <div className="overline mb-1.5">{overline}</div>}
        <h1 className="type-page text-text">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-text-secondary">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
