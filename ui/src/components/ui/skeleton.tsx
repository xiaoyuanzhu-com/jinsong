import { cn } from "@/lib/utils"

/**
 * shadcn "new-york" Skeleton primitive.
 *
 * A thin wrapper over a muted block with Tailwind's animate-pulse — used to
 * reserve layout while data is loading so the dashboard doesn't jump when
 * KPI values arrive.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
