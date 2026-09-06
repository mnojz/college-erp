import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";

type InfoCardProps = {
  title: string;
  icon: ComponentType<{ size?: number | string; stroke?: number | string }>;
  rows: [string, string][];
};

export function InfoCard({ title, icon: Icon, rows }: InfoCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-8 items-center justify-center rounded-md bg-muted">
            <Icon size={18} aria-hidden="true" />
          </span>
          {title}
        </h2>
        <dl className="divide-y divide-border">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 py-2 text-sm">
              <dt className="shrink-0 text-muted-foreground">{label}</dt>
              <dd className="truncate text-right font-medium">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
