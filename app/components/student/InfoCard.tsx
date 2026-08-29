import type { ComponentType } from "react";

type InfoCardProps = {
  title: string;
  icon: ComponentType<{ size?: number | string; stroke?: number | string }>;
  rows: [string, string][];
};

export function InfoCard({ title, icon: Icon, rows }: InfoCardProps) {
  return (
    <section className="profile-info-card">
      <h2>
        <Icon size={20} />
        {title}
      </h2>
      <dl>
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </section>
  );
}
