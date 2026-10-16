import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border-0 border-transparent px-2 py-0.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:ring-[2px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "bg-primary/15 text-primary dark:bg-primary/20 dark:text-primary [a]:hover:bg-primary/25",
        primary:
          "bg-primary/15 text-primary dark:bg-primary/20 dark:text-primary [a]:hover:bg-primary/25",
        secondary:
          "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 [a]:hover:bg-indigo-500/25",
        destructive:
          "bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 [a]:hover:bg-rose-500/25",
        success:
          "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 [a]:hover:bg-emerald-500/25",
        warning:
          "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 [a]:hover:bg-amber-500/25",
        info:
          "bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400 [a]:hover:bg-sky-500/25",
        purple:
          "bg-purple-500/15 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 [a]:hover:bg-purple-500/25",
        outline:
          "bg-primary/15 text-primary dark:bg-primary/20 dark:text-primary [a]:hover:bg-primary/25",
        ghost:
          "hover:bg-primary/10 text-primary",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
