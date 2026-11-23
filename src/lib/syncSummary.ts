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

const MONTH_NAMES_ID = [
  "", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"
];
const MONTH_LABELS_EN = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const MONTH_WEEKS: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5],
  2: [5, 6, 7, 8],
  3: [9, 10, 11, 12, 13],
  4: [14, 15, 16, 17, 18],
  5: [18, 19, 20, 21, 22],
  6: [22, 23, 24, 25, 26],
  7: [27, 28, 29, 30],
  8: [31, 32, 33, 34],
  9: [35, 36, 37, 38, 39],
  10: [40, 41, 42, 43],
  11: [44, 45, 46, 47, 48],
  12: [48, 49, 50, 51, 52],
};

export async function syncSummaryForMonth(site: JobSite, year: number = 2026, month: number = 10) {
  try {
    const weeksForMonth = MONTH_WEEKS[month] || (month === 11 ? [44, 45] : [40, 41, 42, 43]);
    const reps = await prisma.weeklyReport.findMany({
      where: {
        jobSite: site,
        year,
        weekNumber: { in: weeksForMonth },
      },
      include: { items: true },
      orderBy: { weekNumber: "asc" },
    });

    if (reps.length === 0) return;

    const lastRep = reps[reps.length - 1];
    const hasMtdData = lastRep && lastRep.items.some(
      (it) => it.mtdBudgetCost !== null && it.mtdBudgetCost !== undefined && it.mtdBudgetCost > 0
    );

    let totalBudProd = reps.reduce((sum, r) => sum + r.budgetProduksi, 0);
    let totalRealProd = reps.reduce((sum, r) => sum + r.realisasiProduksi, 0);

    if (hasMtdData && lastRep.mtdBudgetProduksi !== null && lastRep.mtdBudgetProduksi !== undefined) {
      totalBudProd = lastRep.mtdBudgetProduksi;
      totalRealProd = lastRep.mtdRealisasiProduksi ?? totalRealProd;
    }

    const achProd = totalBudProd > 0 ? (totalRealProd / totalBudProd) * 100 : 0;

    let endDay = "15";
    if (lastRep && lastRep.periodName) {
      const match = lastRep.periodName.match(/(\d{1,2})\s*(?:-|–|s\/d|\s)\s*(\d{1,2})/);
      if (match) {
        endDay = match[2].padStart(2, "0");
      }
    }
    const monthNameId = MONTH_NAMES_ID[month] || "Okt";
    const computedPeriodName = `01-${endDay} ${monthNameId} ${year}`;
    const monthLabelEn = MONTH_LABELS_EN[month] || "Oct";

    const acctMap = new Map<string, { budget: number; realisasi: number }>();
    if (hasMtdData) {
      for (const it of lastRep.items) {
        acctMap.set(it.accountName, {
          budget: it.mtdBudgetCost ?? 0,
          realisasi: it.mtdRealisasiCost ?? 0,
        });
      }
    } else {
      for (const r of reps) {
        for (const it of r.items) {
          const cur = acctMap.get(it.accountName) || { budget: 0, realisasi: 0 };
          cur.budget += it.budgetCost;
          cur.realisasi += it.realisasiCost;
          acctMap.set(it.accountName, cur);
        }
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
        monthLabel: monthLabelEn,
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
