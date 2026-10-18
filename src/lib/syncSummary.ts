import { prisma } from "./prisma";
import { JobSite } from "../generated/prisma/client";

const SUMMARY_ACCOUNTS = [
  "BIAYA PRODUKSI",
  "BEBAN COMPENSATION AND BENEFIT - SITE",
  "BEBAN CONSUMABLES",
  "BEBAN FUEL - PRODUCTION",
  "BEBAN TYRE",
  "BEBAN SUB KONTRAKTOR",
  "BEBAN RENTAL ALAT PRODUKSI",
  "BEBAN REPAIRS & MAINTENANCE",
  "BEBAN SPAREPART",
  "BEBAN TOOLS",
  "BEBAN OVERHEAD COST - SITE",
  "BEBAN RENTAL ALAT NON PRODUKSI",
  "BEBAN MOBILISASI",
  "BEBAN PENYUSUTAN DAN AMORTISASI - SITE",
];

const PARENT_ACCOUNTS = new Set([
  "BEBAN COMPENSATION AND BENEFIT - SITE",
  "BEBAN CONSUMABLES",
  "BEBAN SUB KONTRAKTOR",
  "BEBAN REPAIRS & MAINTENANCE",
  "BEBAN OVERHEAD COST - SITE",
  "BEBAN MOBILISASI",
  "BEBAN PENYUSUTAN DAN AMORTISASI - SITE",
]);

export async function syncSummaryForMonth(site: JobSite, year: number = 2026, month: number = 10) {
  try {
    const reps = await prisma.weeklyReport.findMany({
      where: {
        jobSite: site,
        year,
        weekNumber: { in: [40, 41, 42, 43, 44] },
      },
      include: { items: true },
      orderBy: { weekNumber: "asc" },
    });

    if (reps.length === 0) return;

    let totalBudProd = reps.reduce((sum, r) => sum + r.budgetProduksi, 0);
    if (site === "MuaraPahu") {
      totalBudProd = Math.max(...reps.map((r) => r.budgetProduksi), 0);
    }
    const totalRealProd = reps.reduce((sum, r) => sum + r.realisasiProduksi, 0);
    const achProd = totalBudProd > 0 ? (totalRealProd / totalBudProd) * 100 : 0;

    const lastRep = reps[reps.length - 1];
    let endDay = "15";
    if (lastRep && lastRep.periodName) {
      const match = lastRep.periodName.match(/(\d{1,2})\s*(?:-|–|s\/d|\s)\s*(\d{1,2})/);
      if (match) {
        endDay = match[2].padStart(2, "0");
      }
    }
    const computedPeriodName = `01-${endDay} Okt ${year}`;

    const acctMap = new Map<string, { budget: number; realisasi: number }>();
    for (const r of reps) {
      for (const it of r.items) {
        const cur = acctMap.get(it.accountName) || { budget: 0, realisasi: 0 };
        if (site === "MuaraPahu") {
          cur.budget = Math.max(cur.budget, it.budgetCost);
        } else {
          cur.budget += it.budgetCost;
        }
        cur.realisasi += it.realisasiCost;
        acctMap.set(it.accountName, cur);
      }
    }

    let totalBiayaB = 0;
    let totalBiayaR = 0;
    for (const [name, val] of acctMap) {
      if (PARENT_ACCOUNTS.has(name)) {
        totalBiayaB += val.budget;
        totalBiayaR += val.realisasi;
      }
    }

    acctMap.set("BIAYA PRODUKSI", { budget: totalBiayaB, realisasi: totalBiayaR });

    const summary = await prisma.pLSummaryOps.upsert({
      where: {
        jobSite_year_month: {
          jobSite: site,
          year,
          month,
        },
      },
      update: {
        periodName: computedPeriodName,
        budgetProduksi: totalBudProd,
        realisasiProduksi: totalRealProd,
        achProduksiPercent: achProd,
      },
      create: {
        jobSite: site,
        year,
        month,
        monthLabel: "Oct",
        periodName: computedPeriodName,
        budgetProduksi: totalBudProd,
        realisasiProduksi: totalRealProd,
        achProduksiPercent: achProd,
      },
    });

    for (let idx = 0; idx < SUMMARY_ACCOUNTS.length; idx++) {
      const accName = SUMMARY_ACCOUNTS[idx];
      const val = acctMap.get(accName) || { budget: 0, realisasi: 0 };

      const bCost = Math.max(0, val.budget);
      const rCost = Math.max(0, val.realisasi);

      const bIdrTon = totalBudProd > 0 ? bCost / totalBudProd : 0;
      const rIdrTon = totalRealProd > 0 ? rCost / totalRealProd : 0;

      const bPctNS = totalBiayaB > 0 ? (bCost / totalBiayaB) * 100 : 0;
      const rPctNS = totalBiayaR > 0 ? (rCost / totalBiayaR) * 100 : 0;

      const achPct = bCost > 0 ? (rCost / bCost) * 100 : 0;
      const underOverTon = bIdrTon - rIdrTon;
      const underOver = bCost - rCost;

      await prisma.pLSummaryOpsItem.upsert({
        where: {
          summaryId_accountName: {
            summaryId: summary.id,
            accountName: accName,
          },
        },
        update: {
          orderIndex: idx + 1,
          budgetCost: bCost,
          budgetIdrPerTon: bIdrTon,
          budgetPercentNS: bPctNS,
          realisasiCost: rCost,
          realisasiIdrPerTon: rIdrTon,
          realisasiPercentNS: rPctNS,
          achPercent: achPct,
          costUnderOverPerTon: underOverTon,
          costUnderOver: underOver,
        },
        create: {
          summaryId: summary.id,
          accountName: accName,
          orderIndex: idx + 1,
          budgetCost: bCost,
          budgetIdrPerTon: bIdrTon,
          budgetPercentNS: bPctNS,
          realisasiCost: rCost,
          realisasiIdrPerTon: rIdrTon,
          realisasiPercentNS: rPctNS,
          achPercent: achPct,
          costUnderOverPerTon: underOverTon,
          costUnderOver: underOver,
        },
      });
    }
  } catch (err) {
    console.error("Error auto-syncing PLSummaryOps:", err);
  }
}
