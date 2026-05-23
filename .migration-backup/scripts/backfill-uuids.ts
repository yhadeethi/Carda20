import { db } from "../server/db";
import { companies } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

async function backfillUUIDs() {
  console.log("=== UUID Backfill Script ===\n");

  const contactResult = await db.execute(sql`
    UPDATE contacts SET public_id = gen_random_uuid() WHERE public_id IS NULL
  `);
  console.log(`[contacts] Backfilled ${(contactResult as any).rowCount ?? 0} rows with UUIDs`);

  const userEventResult = await db.execute(sql`
    UPDATE user_events SET public_id = gen_random_uuid() WHERE public_id IS NULL
  `);
  console.log(`[user_events] Backfilled ${(userEventResult as any).rowCount ?? 0} rows with UUIDs`);

  await backfillCompanies();

  await backfillUserEventContactsUserId();

  console.log("\n=== Backfill complete ===");
  process.exit(0);
}

async function backfillCompanies() {
  console.log("\n--- Companies userId + publicId backfill ---");

  const allCompanies = await db.select().from(companies);
  const companiesNeedingOwner = allCompanies.filter(c => c.userId === null);

  if (companiesNeedingOwner.length === 0) {
    console.log("[companies] All companies already have userId assigned");
  } else {
    let assignedCount = 0;
    let duplicatedCount = 0;
    let orphanCount = 0;

    for (const company of companiesNeedingOwner) {
      const contactsForCompany = await db.execute(sql`
        SELECT DISTINCT user_id FROM contacts WHERE db_company_id = ${company.id}
      `);
      const rows = (contactsForCompany as any).rows || [];
      const distinctUserIds: number[] = rows.map((r: any) => r.user_id);

      if (distinctUserIds.length === 0) {
        orphanCount++;
        console.log(`  [orphan] company id=${company.id} domain="${company.domain}" - no referencing contacts, leaving userId=NULL`);
      } else if (distinctUserIds.length === 1) {
        await db.update(companies).set({ userId: distinctUserIds[0] }).where(eq(companies.id, company.id));
        assignedCount++;
      } else {
        console.log(`  [ambiguous] company id=${company.id} domain="${company.domain}" referenced by ${distinctUserIds.length} users - duplicating`);

        const firstUserId = distinctUserIds[0];
        await db.update(companies).set({ userId: firstUserId }).where(eq(companies.id, company.id));

        for (let i = 1; i < distinctUserIds.length; i++) {
          const uid = distinctUserIds[i];
          const [newCompany] = await db.insert(companies).values({
            userId: uid,
            domain: company.domain,
            name: company.name,
            industry: company.industry,
            sizeBand: company.sizeBand,
            hqCountry: company.hqCountry,
            hqCity: company.hqCity,
            lastEnrichedAt: company.lastEnrichedAt,
          }).returning();

          const updateResult = await db.execute(sql`
            UPDATE contacts SET db_company_id = ${newCompany.id}
            WHERE db_company_id = ${company.id} AND user_id = ${uid}
          `);
          console.log(`    -> Created company id=${newCompany.id} for userId=${uid}, updated ${(updateResult as any).rowCount ?? 0} contacts`);
          duplicatedCount++;
        }
      }
    }

    console.log(`[companies] Assigned: ${assignedCount}, Duplicated: ${duplicatedCount}, Orphaned: ${orphanCount}`);
  }

  const companyUuidResult = await db.execute(sql`
    UPDATE companies SET public_id = gen_random_uuid() WHERE public_id IS NULL
  `);
  console.log(`[companies] Backfilled ${(companyUuidResult as any).rowCount ?? 0} rows with UUIDs`);
}

async function backfillUserEventContactsUserId() {
  console.log("\n--- user_event_contacts userId backfill ---");

  const result = await db.execute(sql`
    UPDATE user_event_contacts uec
    SET user_id = ue.user_id
    FROM user_events ue
    WHERE uec.event_id = ue.id AND uec.user_id IS NULL
  `);
  console.log(`[user_event_contacts] Backfilled userId for ${(result as any).rowCount ?? 0} rows`);
}

backfillUUIDs().catch(err => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
