export const studentAssets = {
  avatar: "https://www.figma.com/api/mcp/asset/8d14e19d-9072-4438-9c31-9e17f4d35b30.png",
  graduationCap: "https://www.figma.com/api/mcp/asset/a9e591a4-f638-47d1-ac7e-79fde2b971fc.svg",
  sun: "https://www.figma.com/api/mcp/asset/5da43c5c-d6c1-4747-af35-d166b6b9bc54.svg",
  moon: "https://www.figma.com/api/mcp/asset/f81cd692-b855-46df-ace0-f75ff0384f66.svg",
  bell: "https://www.figma.com/api/mcp/asset/1736cb27-13c6-465d-91af-c9374f57b612.svg",
  user: "https://www.figma.com/api/mcp/asset/b724c901-f505-49ba-b189-d054b072cdc4.svg",
  result: "https://www.figma.com/api/mcp/asset/03a54dbc-1828-4a84-b2c5-f1f3ee885314.svg",
  attendance: "https://www.figma.com/api/mcp/asset/44b7a359-5eb6-497c-8f6f-328326d500ea.svg",
  subjects: "https://www.figma.com/api/mcp/asset/071709f3-4078-46f6-8893-a8253df9917e.svg",
  finance: "https://www.figma.com/api/mcp/asset/7b15f7ad-547f-4556-a482-c10973a28787.svg",
  assignment: "https://www.figma.com/api/mcp/asset/641acbe4-4026-45aa-94b0-7a3ebd1effd3.svg",
  schedules: "https://www.figma.com/api/mcp/asset/ba1d74ae-9348-43e2-ade4-3f0b6a157a7c.svg",
  status: "https://www.figma.com/api/mcp/asset/a0819ffd-c305-41b2-adfd-b95d17e4352b.svg",
  school: "https://www.figma.com/api/mcp/asset/d9a9b6c1-884d-444a-8b05-0a5b24e38c46.svg",
  calendar: "https://www.figma.com/api/mcp/asset/65423904-3540-41b1-8316-00ee743defb9.svg",
  download: "https://www.figma.com/api/mcp/asset/72d3953f-bff7-49f7-a044-0701e00771e4.svg",
  edit: "https://www.figma.com/api/mcp/asset/88a54a78-eec7-4ea9-91ce-901c31bf173d.svg",
  personal: "https://www.figma.com/api/mcp/asset/4a096f40-7a78-4cc6-9c19-dc90f439a333.svg",
  contact: "https://www.figma.com/api/mcp/asset/c782e38f-5512-4d51-be83-130abce7749d.svg",
  academic: "https://www.figma.com/api/mcp/asset/8358fdfd-933e-4093-92b1-1c65a0cb6cce.svg",
  guardian: "https://www.figma.com/api/mcp/asset/59d1f9ce-c2cd-42b5-a656-a7562de2dcbe.svg",
} as const;

export function AssetIcon({ src, size = 20, alt = "" }: { src: string; size?: number; alt?: string }) {
  return <img src={src} alt={alt} width={size} height={size} />;
}
