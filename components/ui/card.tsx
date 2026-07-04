import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={cn(
        "bg-surface border border-line rounded-card shadow-soft",
        className
      )}
    >
      {children}
    </Tag>
  );
}
