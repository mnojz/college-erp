import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/**
 * Every assessment created before the publish gate existed was visible to
 * students, so backfill them as published rather than making each teacher's
 * existing results vanish until they re-publish by hand.
 *
 * Assessment has no createdAt column, so "published now" is the best available
 * stamp.
 */
async function main() {
  const total = await prisma.assessment.count();
  const pending = await prisma.assessment.count({ where: { publishedAt: null } });
  console.log(`Assessments: ${total} total, ${pending} not yet published.`);

  if (pending === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  const updated = await prisma.$executeRaw`
    UPDATE "Assessment" SET "publishedAt" = NOW() WHERE "publishedAt" IS NULL
  `;

  const after = await prisma.assessment.count({ where: { publishedAt: null } });
  console.log(`Backfilled ${updated} assessment(s). Still unpublished: ${after}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
