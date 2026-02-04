import { ArrowLeft, LucideIcon } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string | ReactNode;
  subtitle?: string | ReactNode;
  icon?: LucideIcon;
  customIcon?: ReactNode;
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
  customIcon,
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
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-4xl font-serif font-bold flex items-center gap-3 sm:gap-4">
            {customIcon ? (
              customIcon
            ) : Icon ? (
              <Icon className="w-8 h-8 text-[var(--subheading-text)] flex-shrink-0" />
            ) : null}
            <span className="text-[var(--heading-text)] min-w-0">{title}</span>
          </h1>
          {subtitle && (
            <p className="text-base text-[var(--subheading-text)] mt-2 font-medium">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex-shrink-0 self-center">{actions}</div>}
      </div>
    </div>
  );
}
