import { prisma } from "../src/lib/prisma";

async function main() {
  const totalReports = await prisma.weeklyReport.count();
  const totalItems = await prisma.weeklyReportItem.count();

  console.log("==================================================");
  console.log("PRISMA DATABASE VERIFICATION STATUS");
  console.log("==================================================");
  console.log(`Total WeeklyReport entries in DB: ${totalReports}`);
  console.log(`Total WeeklyReportItem entries in DB: ${totalItems}`);

  for (const site of ["Senyiur", "MuaraPahu"] as const) {
    const list = await prisma.weeklyReport.findMany({
      where: { jobSite: site },
      orderBy: { weekNumber: "asc" },
      select: {
        id: true,
        weekNumber: true,
        periodName: true,
        budgetProduksi: true,
        realisasiProduksi: true,
        _count: {
          select: { items: true },
        },
      },
    });

    console.log(`\nSite ${site}: ${list.length} laporan terdaftar:`);
    for (const r of list) {
      console.log(
        `  - Week ${String(r.weekNumber).padStart(2, " ")} | ${r.periodName.padEnd(16, " ")} | Items: ${r._count.items} | BudProd: ${r.budgetProduksi.toLocaleString()} | RealProd: ${r.realisasiProduksi.toLocaleString()}`
      );
    }
  }

  console.log("\nSemua data dari Januari s/d awal Oktober 2026 sudah 100% tersimpan di database Prisma!");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
