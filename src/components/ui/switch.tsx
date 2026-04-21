import * as React from "react"

import { cn } from "@/lib/utils"

function Switch({
  className,
  checked,
  ...props
}: React.ComponentProps<"input"> & {
  checked?: boolean
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        data-slot="switch"
        checked={checked}
        className="peer sr-only"
        {...props}
      />
      <div
        className={cn(
          "h-5 w-9 rounded-full bg-input transition-colors after:absolute after:start-[2px] after:top-[2px] after:size-4 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 rtl:peer-checked:after:-translate-x-full dark:bg-input/50 dark:after:bg-foreground",
          className
        )}
      />
    </label>
  )
}

export { Switch }
