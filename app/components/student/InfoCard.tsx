import { AssetIcon } from "./assets";

type InfoCardProps = { title: string; icon: string; rows: [string, string][] };

export function InfoCard({ title, icon, rows }: InfoCardProps) {
  return (
    <section className="profile-info-card">
      <h2><AssetIcon src={icon} size={20} />{title}</h2>
      <dl>
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </section>
  );
}
