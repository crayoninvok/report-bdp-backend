import { prisma } from "../src/lib/prisma";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Starting import of Excel 2026 data into database...");

  const jsonPath = path.resolve(__dirname, "../../scripts/extracted_reports.json");
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File ${jsonPath} not found`);
  }

  const rawData = fs.readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(rawData);

  for (const siteKey of ["Senyiur", "MuaraPahu"]) {
    const siteReports = data[siteKey];
    console.log(`Importing ${siteReports.length} reports for Site ${siteKey}...`);

    for (const rep of siteReports) {
      console.log(`- Upserting W${rep.weekNumber} (${rep.periodName}) for ${rep.jobSite}...`);

      const report = await prisma.weeklyReport.upsert({
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

      // Upsert items
      for (let i = 0; i < rep.items.length; i++) {
        const it = rep.items[i];
        await prisma.weeklyReportItem.upsert({
          where: {
            reportId_accountName: {
              reportId: report.id,
              accountName: it.accountName,
            },
          },
          update: {
            budgetCost: it.budgetCost,
            realisasiCost: it.realisasiCost,
            ytdBudgetCost: it.ytdBudgetCost,
            ytdRealisasiCost: it.ytdRealisasiCost,
            orderIndex: it.orderIndex + 1,
          },
          create: {
            reportId: report.id,
            accountName: it.accountName,
            orderIndex: it.orderIndex + 1,
            budgetCost: it.budgetCost,
            realisasiCost: it.realisasiCost,
            ytdBudgetCost: it.ytdBudgetCost,
            ytdRealisasiCost: it.ytdRealisasiCost,
          },
        });
      }
    }
  }

  console.log("Successfully imported and updated all 2026 reports!");
}

main()
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
