import { prisma } from "../src/lib/prisma";
import fs from "fs";
import path from "path";

async function main() {
  console.log("==========================================================");
  console.log("EXECUTING FAST BATCH MIGRATION FROM EXCEL WORKBOOK");
  console.log("==========================================================");

  const jsonPath = path.resolve(__dirname, "../../scripts/full_migration_data.json");
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Migration data file not found at ${jsonPath}`);
  }

  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(raw);

  // ---------------------------------------------------------
  // 1. MIGRATE WEEKLY REPORTS WITH ALL 86 ACCOUNTS (BATCHED)
  // ---------------------------------------------------------
  console.log("\n[1/2] Migrating Weekly Reports & 86 Detailed Accounts...");

  for (const site of ["Senyiur", "MuaraPahu"] as const) {
    const reports = data.weekly[site];
    console.log(`Processing Site ${site} (${reports.length} weekly periods):`);

    for (const rep of reports) {
      const weeklyReport = await prisma.weeklyReport.upsert({
        where: {
          jobSite_year_weekNumber: {
            jobSite: rep.jobSite as any,
            year: rep.year,
            weekNumber: rep.weekNumber,
          },
        },
        update: {
          periodName: rep.periodName,
          startDate: new Date(rep.startDate),
          endDate: new Date(rep.endDate),
          budgetProduksi: rep.budgetProduksi,
          realisasiProduksi: rep.realisasiProduksi,
          ytdBudgetProduksi: rep.ytdBudgetProduksi,
          ytdRealisasiProduksi: rep.ytdRealisasiProduksi,
          status: "Final",
        },
        create: {
          jobSite: rep.jobSite as any,
          periodName: rep.periodName,
          startDate: new Date(rep.startDate),
          endDate: new Date(rep.endDate),
          year: rep.year,
          weekNumber: rep.weekNumber,
          budgetProduksi: rep.budgetProduksi,
          realisasiProduksi: rep.realisasiProduksi,
          ytdBudgetProduksi: rep.ytdBudgetProduksi,
          ytdRealisasiProduksi: rep.ytdRealisasiProduksi,
          status: "Final",
        },
      });

      // Clear existing items for clean batch insert
      await prisma.weeklyReportItem.deleteMany({
        where: { reportId: weeklyReport.id },
      });

      // Batch insert all 86 items in ONE query
      const itemsToInsert = rep.items.map((it: any) => ({
        reportId: weeklyReport.id,
        accountCode: it.accountCode,
        accountName: it.accountName,
        costBehavior: it.costBehavior,
        accountGroup: it.accountGroup,
        subCategory: it.subCategory,
        isParent: it.isParent,
        parentName: it.parentName,
        orderIndex: it.orderIndex,
        budgetCost: it.budgetCost,
        realisasiCost: it.realisasiCost,
        ytdBudgetCost: it.ytdBudgetCost,
        ytdRealisasiCost: it.ytdRealisasiCost,
      }));

      await prisma.weeklyReportItem.createMany({
        data: itemsToInsert,
      });

      console.log(`  ✔ Week ${String(rep.weekNumber).padStart(2, " ")} (${rep.periodName}) -> ${itemsToInsert.length} accounts inserted`);
    }
  }

  // ---------------------------------------------------------
  // 2. MIGRATE PL SUMMARY 1 OPS (MONTHLY SUMMARY TABLE)
  // ---------------------------------------------------------
  console.log("\n[2/2] Migrating PL Summary 1 OPS (Monthly Summary Table)...");

  for (const site of ["Senyiur", "MuaraPahu"] as const) {
    const summaries = data.summaryOps[site];
    console.log(`Processing Site ${site} (${summaries.length} monthly summaries):`);

    for (const sm of summaries) {
      const summaryRecord = await prisma.pLSummaryOps.upsert({
        where: {
          jobSite_year_month: {
            jobSite: sm.jobSite as any,
            year: sm.year,
            month: sm.month,
          },
        },
        update: {
          monthLabel: sm.monthLabel,
          periodName: sm.periodName,
          budgetProduksi: sm.budgetProduksi,
          realisasiProduksi: sm.realisasiProduksi,
          achProduksiPercent: sm.achProduksiPercent,
        },
        create: {
          jobSite: sm.jobSite as any,
          year: sm.year,
          month: sm.month,
          monthLabel: sm.monthLabel,
          periodName: sm.periodName,
          budgetProduksi: sm.budgetProduksi,
          realisasiProduksi: sm.realisasiProduksi,
          achProduksiPercent: sm.achProduksiPercent,
        },
      });

      // Clear existing items
      await prisma.pLSummaryOpsItem.deleteMany({
        where: { summaryId: summaryRecord.id },
      });

      // Batch insert all 14 summary items
      const summaryItemsToInsert = sm.items.map((it: any) => ({
        summaryId: summaryRecord.id,
        accountName: it.accountName,
        orderIndex: it.orderIndex,
        budgetCost: it.budgetCost,
        budgetPercentNS: it.budgetPercentNS,
        budgetIdrPerTon: it.budgetIdrPerTon,
        realisasiCost: it.realisasiCost,
        realisasiPercentNS: it.realisasiPercentNS,
        realisasiIdrPerTon: it.realisasiIdrPerTon,
        achPercent: it.achPercent,
        costUnderOverPerTon: it.costUnderOverPerTon,
        costUnderOver: it.costUnderOver,
      }));

      await prisma.pLSummaryOpsItem.createMany({
        data: summaryItemsToInsert,
      });

      console.log(`  ✔ Month ${String(sm.month).padStart(2, " ")} (${sm.monthLabel}) -> ${summaryItemsToInsert.length} items inserted`);
    }
  }

  console.log("\n==========================================================");
  console.log("FULL MIGRATION COMPLETED SUCCESSFULLY!");
  console.log("==========================================================");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
