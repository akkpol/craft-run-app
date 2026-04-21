import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-lg bg-muted/50 dark:bg-muted/30",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
