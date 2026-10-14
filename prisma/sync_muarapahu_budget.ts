import { prisma } from "../src/lib/prisma";

async function fastSyncMuaraPahuBudget() {
  console.log("==========================================================");
  console.log("FAST SYNC MUARA PAHU BUDGET FROM PL SUMMARY 1 OPS");
  console.log("==========================================================");

  const monthToWeekMap: Record<number, number> = {
    7: 30,  // Jul -> W30
    8: 34,  // Aug -> W34
    9: 39,  // Sep -> W39
    10: 40, // Oct -> W40
  };

  const summaries = await prisma.pLSummaryOps.findMany({
    where: {
      jobSite: "MuaraPahu",
      year: 2026,
      month: { in: [7, 8, 9, 10] },
    },
    include: { items: true },
    orderBy: { month: "asc" },
  });

  for (const sum of summaries) {
    const weekNumber = monthToWeekMap[sum.month];
    if (!weekNumber) continue;

    const weeklyReport = await prisma.weeklyReport.findUnique({
      where: {
        jobSite_year_weekNumber: {
          jobSite: "MuaraPahu",
          year: 2026,
          weekNumber,
        },
      },
    });

    if (!weeklyReport) {
      console.log(`⚠️ Week ${weekNumber} report not found`);
      continue;
    }

    // 1. Update budgetProduksi on the weekly report
    await prisma.weeklyReport.update({
      where: { id: weeklyReport.id },
      data: {
        budgetProduksi: sum.budgetProduksi || 0,
      },
    });
    console.log(
      `✔ Week ${weekNumber} (${sum.monthLabel}): Budget Produksi updated to ${sum.budgetProduksi.toLocaleString(
        "id-ID"
      )} Ton`
    );

    // 2. Update accounts with budget > 0
    const nonZeroItems = sum.items.filter(
      (it) => it.budgetCost > 0 && it.accountName.trim().toUpperCase() !== "BIAYA PRODUKSI"
    );

    for (const it of nonZeroItems) {
      const cleanName = it.accountName.trim();
      await prisma.weeklyReportItem.updateMany({
        where: {
          reportId: weeklyReport.id,
          accountName: {
            equals: cleanName,
            mode: "insensitive",
          },
        },
        data: {
          budgetCost: it.budgetCost,
        },
      });
      console.log(`   - ${cleanName}: Rp ${it.budgetCost.toLocaleString("id-ID")}`);
    }
  }

  console.log("\n==========================================================");
  console.log("FAST SYNC COMPLETE!");
  console.log("==========================================================");
}

fastSyncMuaraPahuBudget()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
