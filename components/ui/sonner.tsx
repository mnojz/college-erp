"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      duration={4000}
      closeButton={false}
      richColors={false}
      icons={{
        success: (
          <CircleCheckIcon className="size-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
        ),
        info: (
          <InfoIcon className="size-5 text-sky-500 dark:text-sky-400 shrink-0" />
        ),
        warning: (
          <TriangleAlertIcon className="size-5 text-amber-500 dark:text-amber-400 shrink-0" />
        ),
        error: (
          <OctagonXIcon className="size-5 text-rose-500 dark:text-rose-400 shrink-0" />
        ),
        loading: (
          <Loader2Icon className="size-5 text-primary animate-spin shrink-0" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--card-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--card)",
          "--success-text": "var(--card-foreground)",
          "--success-border": "var(--border)",
          "--error-bg": "var(--card)",
          "--error-text": "var(--card-foreground)",
          "--error-border": "var(--border)",
          "--warning-bg": "var(--card)",
          "--warning-text": "var(--card-foreground)",
          "--warning-border": "var(--border)",
          "--info-bg": "var(--card)",
          "--info-text": "var(--card-foreground)",
          "--info-border": "var(--border)",
          "--border-radius": "12px",
          "--toast-duration": "4000ms",
        } as React.CSSProperties
      }
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: "erp-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
