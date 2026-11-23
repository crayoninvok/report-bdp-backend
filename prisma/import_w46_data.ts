import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { parseExcelReport } from "../src/lib/excelParser";
import { syncSummaryForMonth } from "../src/lib/syncSummary";
import { JobSite } from "../src/generated/prisma/client";

async function main() {
  console.log("==========================================================");
  console.log("IMPORTING WEEK 46 FINANCIAL REPORT (YTD 19 NOV 2026)");
  console.log("==========================================================");

  const excelPath = path.resolve(__dirname, "../../11.26 - Lap Keu BDP 1 Update - YTD November 2026 Site (19112026) (1).xlsx");
  if (!fs.existsSync(excelPath)) {
    throw new Error(`File not found: ${excelPath}`);
  }

  const buffer = fs.readFileSync(excelPath);
  const parseResult = await parseExcelReport(buffer, "11.26 - Lap Keu BDP 1 Update - YTD November 2026 Site (19112026) (1).xlsx");

  const w46Reports = parseResult.reports.filter((r) => r.weekNumber === 46);
  console.log(`Found ${w46Reports.length} W46 report(s) to import.`);

  for (const rep of w46Reports) {
    console.log(`\nImporting ${rep.jobSite} W${rep.weekNumber} (${rep.periodName})...`);
    console.log(`  Produksi Weekly: Budget=${rep.produksi.weeklyBudget} Real=${rep.produksi.weeklyRealisasi}`);
    console.log(`  Biaya Weekly: Budget=${rep.biayaProduksi.weeklyBudget} Real=${rep.biayaProduksi.weeklyRealisasi}`);

    const saved = await prisma.weeklyReport.upsert({
      where: {
        jobSite_year_weekNumber: {
          jobSite: rep.jobSite as JobSite,
          year: rep.year,
          weekNumber: rep.weekNumber,
        },
      },
      update: {
        periodName: rep.periodName,
        startDate: new Date(rep.startDate),
        endDate: new Date(rep.endDate),
        budgetProduksi: rep.produksi.weeklyBudget,
        realisasiProduksi: rep.produksi.weeklyRealisasi,
        mtdBudgetProduksi: rep.produksi.rawBudget,
        mtdRealisasiProduksi: rep.produksi.rawRealisasi,
        ytdBudgetProduksi: rep.produksi.ytdBudget,
        ytdRealisasiProduksi: rep.produksi.ytdRealisasi,
        status: "Final",
      },
      create: {
        jobSite: rep.jobSite as JobSite,
        periodName: rep.periodName,
        startDate: new Date(rep.startDate),
        endDate: new Date(rep.endDate),
        year: rep.year,
        weekNumber: rep.weekNumber,
        budgetProduksi: rep.produksi.weeklyBudget,
        realisasiProduksi: rep.produksi.weeklyRealisasi,
        mtdBudgetProduksi: rep.produksi.rawBudget,
        mtdRealisasiProduksi: rep.produksi.rawRealisasi,
        ytdBudgetProduksi: rep.produksi.ytdBudget,
        ytdRealisasiProduksi: rep.produksi.ytdRealisasi,
        status: "Final",
      },
    });

    // Recreate items
    await prisma.weeklyReportItem.deleteMany({
      where: { reportId: saved.id },
    });

    const itemsToCreate = rep.items.map((it) => ({
      reportId: saved.id,
      accountName: it.accountName,
      accountCode: it.accountCode,
      costBehavior: it.costBehavior,
      accountGroup: it.accountGroup,
      subCategory: it.subCategory,
      isParent: it.isParent,
      parentName: it.parentName,
      orderIndex: it.orderIndex,
      budgetCost: it.weeklyBudgetCost,
      realisasiCost: it.weeklyRealisasiCost,
      mtdBudgetCost: it.rawBudgetCost,
      mtdRealisasiCost: it.rawRealisasiCost,
      ytdBudgetCost: it.ytdBudgetCost,
      ytdRealisasiCost: it.ytdRealisasiCost,
    }));

    await prisma.weeklyReportItem.createMany({
      data: itemsToCreate,
    });

    console.log(`  ✔ Successfully saved W46 with ${itemsToCreate.length} account items.`);
  }

  // Synchronize Month 11 in PLSummaryOps for both sites
  console.log("\nSynchronizing Month 11 in PLSummaryOps...");
  for (const site of ["Senyiur", "MuaraPahu"] as const) {
    await syncSummaryForMonth(site, 2026, 11);
    console.log(`  ✔ Synchronized Month 11 for Site ${site}`);
  }

  console.log("\n==========================================================");
  console.log("W46 IMPORT & MONTH 11 SYNC COMPLETED SUCCESSFULLY!");
  console.log("==========================================================");
}

main()
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
