"use client";

import type { ReactNode } from "react";

type SectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
};

export default function Section({
  title,
  description,
  action,
  children,
  id,
}: SectionProps) {
  return (
    <section
      id={id}
      className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
