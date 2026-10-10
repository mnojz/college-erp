import "dotenv/config";
import { writeFileSync } from "node:fs";
import { prisma } from "../app/lib/prisma";

// Create order = parents before children (topological by FK).
const CREATE_ORDER = [
  "Department", "User", "Program", "Teacher", "Student", "AcademicYear",
  "Subject", "Curriculum", "CurriculumYear", "CurriculumSemester", "CurriculumCourse", "CurriculumElective",
  "SubjectTeacher", "Class", "Break", "Assessment", "Result", "Announcement",
  "StudyMaterial", "StudyMaterialClass", "Bookmark", "Syllabus",
  "AttendanceSession", "AttendanceRecord", "Notification", "ProfilePrivacy", "StudentSemester",
] as const;

// Tables whose `fileData` (Bytes) holds the actual uploaded file. These blobs
// are far too large to commit (tens of MB); we keep the row + metadata but
// blank the binary so the seed stays committable. Files must be re-uploaded.
const BLOB_TABLES: Record<string, string> = {
  Syllabus: "fileData",
  StudyMaterial: "fileData",
};

const clientKey = (m: string) => m[0].toLowerCase() + m.slice(1);

async function main() {
  const DATA: Record<string, unknown[]> = {};
  for (const model of CREATE_ORDER) {
    let rows: any[] = await (prisma as any)[clientKey(model)].findMany();
    const blobField = BLOB_TABLES[model];
    if (blobField) {
      rows = rows.map((r) => ({ ...r, [blobField]: { __buffer__: [] } }));
    }
    DATA[model] = rows;
    console.log(model.padEnd(22), rows.length);
  }

  // Tag Date and Buffer instances so JSON round-trips losslessly.
  const payload = JSON.stringify(DATA, (_k, v) => {
    if (v instanceof Date) return { __date__: v.toISOString() };
    if (Buffer.isBuffer(v)) return { __buffer__: Array.from(v) };
    return v;
  });
  const literal = JSON.stringify(payload); // safe double-quoted JS string literal

  const lines: string[] = [];
  lines.push('import "dotenv/config";');
  lines.push('import { prisma } from "../app/lib/prisma";');
  lines.push("");
  lines.push("/**");
  lines.push(" * Database seed - a faithful snapshot of the current development database.");
  lines.push(" * Idempotent: TRUNCATEs every table (CASCADE) then re-creates all rows in");
  lines.push(" * FK-dependency order, preserving ids, relations, dates and enums.");
  lines.push(" *");
  lines.push(" * NOTE: uploaded file blobs (Syllabus.fileData, StudyMaterial.fileData) are");
  lines.push(" * intentionally blank - they are tens of MB and not committable. Re-upload");
  lines.push(" * the actual files via the app after seeding.");
  lines.push(" */");
  lines.push("const RAW = " + literal + ";");
  lines.push("");
  lines.push("const DATA = JSON.parse(RAW, (_k, v) => {");
  lines.push('  if (v && typeof v === "object" && typeof v.__date__ === "string") return new Date(v.__date__);');
  lines.push('  if (v && typeof v === "object" && Array.isArray(v.__buffer__)) return Buffer.from(v.__buffer__);');
  lines.push("  return v;");
  lines.push("});");
  lines.push("");
  lines.push("const CREATE_ORDER = " + JSON.stringify(CREATE_ORDER) + ";");
  lines.push("const clientKey = (m: string) => m[0].toLowerCase() + m.slice(1);");
  lines.push('const TABLE_NAMES = CREATE_ORDER.map((m) => \'"\' + m + \'"\').join(", ");');
  lines.push("");
  lines.push("async function main() {");
  lines.push('  await prisma.$executeRawUnsafe("TRUNCATE TABLE " + TABLE_NAMES + " RESTART IDENTITY CASCADE");');
  lines.push("  for (const model of CREATE_ORDER) {");
  lines.push("    const rows = DATA[model] ?? [];");
  lines.push("    if (rows.length === 0) continue;");
  lines.push("    await (prisma as any)[clientKey(model)].createMany({ data: rows });");
  lines.push('    console.log("  seeded " + model + " " + rows.length);');
  lines.push("  }");
  lines.push("}");
  lines.push("");
  lines.push("main()");
  lines.push("  .then(() => prisma.$disconnect())");
  lines.push("  .catch(async (e) => {");
  lines.push("    console.error(e);");
  lines.push("    await prisma.$disconnect();");
  lines.push("    process.exit(1);");
  lines.push("  });");
  lines.push("");

  const seed = lines.join("\n");
  writeFileSync("prisma/seed.ts", seed, "utf8");
  console.log("\nwrote prisma/seed.ts (" + (seed.length / 1024).toFixed(1) + " KB)");
}

main().finally(() => prisma.$disconnect());
