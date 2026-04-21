import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  checked,
  ...props
}: React.ComponentProps<"input"> & {
  checked?: boolean
}) {
  return (
    <div className="relative inline-flex">
      <input
        type="checkbox"
        data-slot="checkbox"
        checked={checked}
        className={cn(
          "peer size-4 shrink-0 appearance-none rounded border border-input bg-background transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 checked:bg-primary checked:border-primary aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:checked:bg-primary dark:aria-invalid:border-destructive/50",
          className
        )}
        {...props}
      />
      <Check className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground opacity-0 transition-opacity peer-checked:opacity-100" />
    </div>
  )
}

export { Checkbox }
