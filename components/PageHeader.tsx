import { ArrowLeft, LucideIcon } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  backLink?: {
    href: string;
    label: string;
  };
  actions?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  backLink,
  actions,
}: PageHeaderProps) {
  return (
    <div className="border-b border-[var(--border-color)] pb-6">
      {backLink && (
        <Link
          href={backLink.href}
          className="inline-flex items-center gap-2 text-[var(--accent)] hover:text-[var(--light-accent)] mb-5 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLink.label}
        </Link>
      )}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-5xl font-serif font-bold text-[var(--heading-text)] flex items-center gap-3">
            <Icon className="w-8 h-8" />
            {title}
          </h1>
          <p className="text-[var(--subheading-text)] mt-2 font-medium">
            {subtitle}
          </p>
        </div>
        {actions && <div className="mt-3 sm:mt-2">{actions}</div>}
      </div>
    </div>
  );
}
