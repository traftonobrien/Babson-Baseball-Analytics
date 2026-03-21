"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className }: Props) {
  if (items.length === 0) return null;

  return (
    <nav className={cn("hidden md:flex mb-4 items-center gap-1.5 text-sm text-zinc-500", className)}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-zinc-300 transition-smooth">
              {item.label}
            </Link>
          ) : (
            <span className="text-zinc-300">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
