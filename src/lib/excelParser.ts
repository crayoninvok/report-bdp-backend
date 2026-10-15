import * as XLSX from "xlsx";
import { prisma } from "./prisma";
import { ACCOUNT_DEFINITIONS, PARENT_ACCOUNT_NAMES } from "../constants/accounts";
import { JobSite } from "../generated/prisma/client";

export const MONTH_MAP: { [key: string]: number } = {
  jan: 1, januari: 1,
  feb: 2, februari: 2,
  mar: 3, maret: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6,
  jul: 7, juli: 7,
  ags: 8, agst: 8, agustus: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10,
  nov: 11, november: 11,
  des: 12, desember: 12,
};

export const MONTH_NAMES_ID = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export interface ParsedItemData {
  accountName: string;
  accountCode: string | null;
  costBehavior: string | null;
  accountGroup: string | null;
  subCategory: string | null;
  isParent: boolean;
  parentName: string | null;
  orderIndex: number;
  // Raw from Excel
  rawBudgetCost: number;
  rawRealisasiCost: number;
  // Subtrahend (pengurang) from previous cumulative period
  pengurangBudgetCost: number;
  pengurangRealisasiCost: number;
  // Net Weekly Delta (raw - pengurang)
  weeklyBudgetCost: number;
  weeklyRealisasiCost: number;
  // YTD
  ytdBudgetCost: number | null;
  ytdRealisasiCost: number | null;
}

export interface ParsedPeriodReport {
  jobSite: JobSite;
  periodName: string;
  year: number;
  month: number;
  startDay: number;
  endDay: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  weekNumber: number;
  isExistingInDb: boolean;
  existingReportId?: string;
  
  // Previous period info used as subtrahend
  pengurangPeriodName: string | null;
  
  // Produksi (Ton)
  produksi: {
    rawBudget: number;
    rawRealisasi: number;
    pengurangBudget: number;
    pengurangRealisasi: number;
    weeklyBudget: number;
    weeklyRealisasi: number;
    ytdBudget: number | null;
    ytdRealisasi: number | null;
  };

  // Total Biaya Produksi (Sum of 7 parent accounts)
  biayaProduksi: {
    rawBudget: number;
    rawRealisasi: number;
    pengurangBudget: number;
    pengurangRealisasi: number;
    weeklyBudget: number;
    weeklyRealisasi: number;
    ytdBudget: number | null;
    ytdRealisasi: number | null;
  };

  items: ParsedItemData[];
}

export interface ExcelParseResult {
  fileName: string;
  detectedSites: JobSite[];
  reports: ParsedPeriodReport[];
  summary: {
    totalPeriodsFound: number;
    newPeriodsCount: number;
    updatePeriodsCount: number;
  };
}

export function cleanFloat(val: any): number {
  if (val === null || val === undefined) return 0.0;
  if (typeof val === "number") return isNaN(val) ? 0.0 : val;
  const str = String(val).trim();
  if (
    str === "" ||
    str.startsWith("#") ||
    str.includes("DIV/0") ||
    str.includes("VALUE") ||
    str.includes("REF") ||
    str === "-"
  ) {
    return 0.0;
  }
  const cleanStr = str.replace(/,/g, "");
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0.0 : num;
}

export function parsePeriodHeader(headerStr: string): {
  startDay: number;
  endDay: number;
  month: number;
  year: number;
} | null {
  const trimmed = headerStr.trim();
  if (trimmed.toUpperCase().includes("YTD")) return null;

  // Pattern: "01-08 Okt 2026", "1-15 Okt 2026", "01-30 April 2026", etc.
  const match = trimmed.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;

  const startDay = parseInt(match[1], 10);
  const endDay = parseInt(match[2], 10);
  const monthKey = match[3].toLowerCase();
  const year = parseInt(match[4], 10);

  const month = MONTH_MAP[monthKey];
  if (!month) return null;

  return { startDay, endDay, month, year };
}

/**
 * Parses an uploaded Excel workbook buffer and computes incremental weekly delta
 * by subtracting the previous cumulative period in the month.
 */
export async function parseExcelReport(
  buffer: Buffer,
  fileName: string = "uploaded.xlsx",
  targetJobSite?: JobSite
): Promise<ExcelParseResult> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = wb.SheetNames;

  const sitesToProcess: { site: JobSite; sheetName: string }[] = [];

  for (const sName of sheetNames) {
    const upper = sName.toUpperCase();
    if (upper.includes("PL WEEK") && (upper.includes("SNY") || upper.includes("SENYIUR"))) {
      if (!targetJobSite || targetJobSite === "Senyiur") {
        sitesToProcess.push({ site: "Senyiur", sheetName: sName });
      }
    } else if (upper.includes("PL WEEK") && (upper.includes("MPH") || upper.includes("MUARA") || upper.includes("PAHU"))) {
      if (!targetJobSite || targetJobSite === "MuaraPahu") {
        sitesToProcess.push({ site: "MuaraPahu", sheetName: sName });
      }
    }
  }

  // Fallback if sheets don't match specific names
  if (sitesToProcess.length === 0) {
    for (const sName of sheetNames) {
      const upper = sName.toUpperCase();
      if (upper.includes("SNY") || upper.includes("SENYIUR")) {
        sitesToProcess.push({ site: "Senyiur", sheetName: sName });
      } else if (upper.includes("MPH") || upper.includes("MUARA")) {
        sitesToProcess.push({ site: "MuaraPahu", sheetName: sName });
      }
    }
  }

  if (sitesToProcess.length === 0 && sheetNames.length > 0) {
    // If only 1 sheet exists, use targetJobSite or default to MuaraPahu
    const defaultSite = targetJobSite || "MuaraPahu";
    sitesToProcess.push({ site: defaultSite, sheetName: sheetNames[0] });
  }

  const allParsedReports: ParsedPeriodReport[] = [];

  for (const { site, sheetName } of sitesToProcess) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    // 1. Fetch existing reports in DB for this site to determine weekNumbers & DB pengurang
    const existingDbReports = await prisma.weeklyReport.findMany({
      where: { jobSite: site },
      orderBy: [{ year: "asc" }, { weekNumber: "asc" }],
      include: {
        items: true,
      },
    });

    const dbReportMapByPeriod = new Map<string, typeof existingDbReports[0]>();
    for (const r of existingDbReports) {
      dbReportMapByPeriod.set(r.periodName.trim().toLowerCase(), r);
    }

    // 2. Identify all period columns in row 6
    interface ColInfo {
      colIndex: number;
      periodName: string;
      startDay: number;
      endDay: number;
      month: number;
      year: number;
      budgetCol: number;
      realCol: number;
      ytdBudgetCol: number | null;
      ytdRealCol: number | null;
    }

    const periodsFound: ColInfo[] = [];

    // Search up to column 150
    for (let c = 1; c <= 150; c++) {
      const colLetter = XLSX.utils.encode_col(c - 1);
      const cell6 = sheet[`${colLetter}6`];
      if (!cell6 || !cell6.v) continue;

      const parsed = parsePeriodHeader(String(cell6.v));
      if (parsed) {
        // Look for adjacent YTD column (typically within next 4-6 columns)
        let ytdBudgetCol: number | null = null;
        let ytdRealCol: number | null = null;

        for (let offset = 4; offset <= 6; offset++) {
          const nextColLetter = XLSX.utils.encode_col(c - 1 + offset);
          const nextCell6 = sheet[`${nextColLetter}6`];
          if (nextCell6 && String(nextCell6.v).toUpperCase().includes("YTD")) {
            ytdBudgetCol = c + offset;
            ytdRealCol = c + offset + 2;
            break;
          }
        }

        periodsFound.push({
          colIndex: c,
          periodName: String(cell6.v).trim(),
          ...parsed,
          budgetCol: c,
          realCol: c + 2,
          ytdBudgetCol,
          ytdRealCol,
        });
      }
    }

    // Sort periods chronologically
    periodsFound.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.month !== b.month) return a.month - b.month;
      return a.endDay - b.endDay;
    });

    // 3. Map accounts in row 11 to 96
    const accountRowMap: { row: number; def: (typeof ACCOUNT_DEFINITIONS)[0] }[] = [];
    const normalizedDefMap = new Map(
      ACCOUNT_DEFINITIONS.map((d) => [d.name.trim().toLowerCase().replace(/\s+/g, " "), d])
    );

    for (let r = 11; r <= 96; r++) {
      const nameCell = sheet[`F${r}`];
      if (!nameCell || !nameCell.v) continue;
      const normalizedName = String(nameCell.v).trim().toLowerCase().replace(/\s+/g, " ");
      const def = normalizedDefMap.get(normalizedName);
      if (def) {
        accountRowMap.push({ row: r, def });
      }
    }

    // 4. Memory cache for cumulative periods in this sheet by month
    // Map key: `${year}-${month}-${endDay}`
    interface CumulativeSnapshot {
      periodName: string;
      endDay: number;
      produksiBudget: number;
      produksiRealisasi: number;
      accountBudgetMap: Map<string, number>;
      accountRealisasiMap: Map<string, number>;
    }

    const monthCumulativeHistory = new Map<string, CumulativeSnapshot[]>();

    for (const p of periodsFound) {
      const monthKey = `${p.year}-${p.month}`;
      if (!monthCumulativeHistory.has(monthKey)) {
        monthCumulativeHistory.set(monthKey, []);
      }
      const historyList = monthCumulativeHistory.get(monthKey)!;

      // Extract raw Produksi
      const bLetter = XLSX.utils.encode_col(p.budgetCol - 1);
      const rLetter = XLSX.utils.encode_col(p.realCol - 1);
      let rawProdBudget = cleanFloat(sheet[`${bLetter}8`]?.v);
      let rawProdReal = cleanFloat(sheet[`${rLetter}8`]?.v);

      // Smart fallback: If PL Week row 8 is 0, check corresponding PL Summary sheet
      if (rawProdBudget === 0 && rawProdReal === 0) {
        const sumSheetKey = site === "Senyiur" ? "PL Summary 1 OPS (SNY) " : "PL Summary 1 OPS (MPH)";
        const sumSheet = wb.Sheets[sumSheetKey] || wb.Sheets[sumSheetKey.trim()];
        if (sumSheet) {
          // Month cols in summary
          const sumColMap: { [month: number]: { sny: number; mph: number } } = {
            1: { sny: 2, mph: 2 },
            2: { sny: 9, mph: 9 },
            3: { sny: 16, mph: 16 },
            4: { sny: 23, mph: 23 },
            5: { sny: 37, mph: 37 },
            6: { sny: 55, mph: 55 },
            7: { sny: 73, mph: 74 },
            8: { sny: 90, mph: 91 },
            9: { sny: 107, mph: 108 },
            10: { sny: 124, mph: 126 },
          };
          const cols = sumColMap[p.month];
          if (cols) {
            const baseC = site === "Senyiur" ? cols.sny : cols.mph;
            const sumBLetter = XLSX.utils.encode_col(baseC - 1);
            const sumRLetter = XLSX.utils.encode_col(baseC + 2); // baseC + 3 in 1-based is baseC + 2 in 0-based
            const sumB = cleanFloat(sumSheet[`${sumBLetter}8`]?.v);
            const sumR = cleanFloat(sumSheet[`${sumRLetter}8`]?.v);
            if (sumB > 0 || sumR > 0) {
              rawProdBudget = sumB;
              rawProdReal = sumR;
            }
          }
        }
      }

      let ytdProdBudget: number | null = null;
      let ytdProdReal: number | null = null;
      if (p.ytdBudgetCol) {
        const ybLetter = XLSX.utils.encode_col(p.ytdBudgetCol - 1);
        ytdProdBudget = cleanFloat(sheet[`${ybLetter}8`]?.v);
      }
      if (p.ytdRealCol) {
        const yrLetter = XLSX.utils.encode_col(p.ytdRealCol - 1);
        ytdProdReal = cleanFloat(sheet[`${yrLetter}8`]?.v);
      }

      // Extract raw items
      const rawAccountBudgetMap = new Map<string, number>();
      const rawAccountRealMap = new Map<string, number>();
      const ytdAccountBudgetMap = new Map<string, number>();
      const ytdAccountRealMap = new Map<string, number>();

      for (const { row, def } of accountRowMap) {
        const bVal = cleanFloat(sheet[`${bLetter}${row}`]?.v);
        const rVal = cleanFloat(sheet[`${rLetter}${row}`]?.v);
        rawAccountBudgetMap.set(def.name, bVal);
        rawAccountRealMap.set(def.name, rVal);

        if (p.ytdBudgetCol) {
          const ybLetter = XLSX.utils.encode_col(p.ytdBudgetCol - 1);
          ytdAccountBudgetMap.set(def.name, cleanFloat(sheet[`${ybLetter}${row}`]?.v));
        }
        if (p.ytdRealCol) {
          const yrLetter = XLSX.utils.encode_col(p.ytdRealCol - 1);
          ytdAccountRealMap.set(def.name, cleanFloat(sheet[`${yrLetter}${row}`]?.v));
        }
      }

      // Determine Subtrahend (Pengurang)
      // Look for the most recent period in the SAME month before this period's endDay
      let pengurangSnapshot: CumulativeSnapshot | null = null;

      // First check within earlier periods in this Excel file
      for (let i = historyList.length - 1; i >= 0; i--) {
        if (historyList[i].endDay < p.endDay) {
          pengurangSnapshot = historyList[i];
          break;
        }
      }

      // If not in this Excel file, check database
      if (!pengurangSnapshot) {
        const dbMatchesInMonth = existingDbReports.filter((r) => {
          const rDate = new Date(r.endDate);
          return (
            rDate.getUTCFullYear() === p.year &&
            rDate.getUTCMonth() + 1 === p.month &&
            rDate.getUTCDate() < p.endDay
          );
        });

        if (dbMatchesInMonth.length > 0) {
          // Sort by endDate descending to get the closest prior period
          dbMatchesInMonth.sort(
            (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
          );
          const latestPrior = dbMatchesInMonth[0];
          const acctBMap = new Map<string, number>();
          const acctRMap = new Map<string, number>();
          for (const it of latestPrior.items) {
            acctBMap.set(it.accountName, it.mtdBudgetCost ?? it.budgetCost);
            acctRMap.set(it.accountName, it.mtdRealisasiCost ?? it.realisasiCost);
          }
          pengurangSnapshot = {
            periodName: latestPrior.periodName,
            endDay: new Date(latestPrior.endDate).getUTCDate(),
            produksiBudget: latestPrior.mtdBudgetProduksi ?? latestPrior.budgetProduksi,
            produksiRealisasi: latestPrior.mtdRealisasiProduksi ?? latestPrior.realisasiProduksi,
            accountBudgetMap: acctBMap,
            accountRealisasiMap: acctRMap,
          };
        }
      }

      // Calculate Net Weekly Delta
      let pengurangProdBudget = 0;
      let pengurangProdReal = 0;
      let pengurangName: string | null = null;

      if (pengurangSnapshot) {
        pengurangName = pengurangSnapshot.periodName;
        pengurangProdBudget = pengurangSnapshot.produksiBudget;
        pengurangProdReal = pengurangSnapshot.produksiRealisasi;
      }

      const weeklyProdBudget = rawProdBudget - pengurangProdBudget;
      const weeklyProdReal = rawProdReal - pengurangProdReal;

      // Build items with deltas
      const reportItems: ParsedItemData[] = [];
      let weeklyTotalBiayaBudget = 0;
      let weeklyTotalBiayaReal = 0;
      let rawTotalBiayaBudget = 0;
      let rawTotalBiayaReal = 0;
      let pengurangTotalBiayaBudget = 0;
      let pengurangTotalBiayaReal = 0;
      let ytdTotalBiayaBudget = 0;
      let ytdTotalBiayaReal = 0;

      for (let idx = 0; idx < ACCOUNT_DEFINITIONS.length; idx++) {
        const def = ACCOUNT_DEFINITIONS[idx];
        const rawB = rawAccountBudgetMap.get(def.name) || 0;
        const rawR = rawAccountRealMap.get(def.name) || 0;

        const pengurangB = pengurangSnapshot?.accountBudgetMap.get(def.name) || 0;
        const pengurangR = pengurangSnapshot?.accountRealisasiMap.get(def.name) || 0;

        const weeklyB = rawB - pengurangB;
        const weeklyR = rawR - pengurangR;

        const ytdB = p.ytdBudgetCol ? (ytdAccountBudgetMap.get(def.name) ?? null) : null;
        const ytdR = p.ytdRealCol ? (ytdAccountRealMap.get(def.name) ?? null) : null;

        if (PARENT_ACCOUNT_NAMES.has(def.name)) {
          rawTotalBiayaBudget += rawB;
          rawTotalBiayaReal += rawR;
          pengurangTotalBiayaBudget += pengurangB;
          pengurangTotalBiayaReal += pengurangR;
          weeklyTotalBiayaBudget += weeklyB;
          weeklyTotalBiayaReal += weeklyR;
          if (ytdB !== null) ytdTotalBiayaBudget += ytdB;
          if (ytdR !== null) ytdTotalBiayaReal += ytdR;
        }

        reportItems.push({
          accountName: def.name,
          accountCode: def.accountCode,
          costBehavior: def.costBehavior,
          accountGroup: def.accountGroup,
          subCategory: def.subCategory,
          isParent: def.isParent,
          parentName: def.parentName || null,
          orderIndex: idx + 1,
          rawBudgetCost: rawB,
          rawRealisasiCost: rawR,
          pengurangBudgetCost: pengurangB,
          pengurangRealisasiCost: pengurangR,
          weeklyBudgetCost: weeklyB,
          weeklyRealisasiCost: weeklyR,
          ytdBudgetCost: ytdB,
          ytdRealisasiCost: ytdR,
        });
      }

      // Record this period's raw data into history so subsequent weeks in this month can subtract it
      historyList.push({
        periodName: p.periodName,
        endDay: p.endDay,
        produksiBudget: rawProdBudget,
        produksiRealisasi: rawProdReal,
        accountBudgetMap: rawAccountBudgetMap,
        accountRealisasiMap: rawAccountRealMap,
      });

      // Dates & Week Number
      const sDateStr = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.startDay).padStart(2, "0")}`;
      const eDateStr = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.endDay).padStart(2, "0")}`;

      const existingDb = dbReportMapByPeriod.get(p.periodName.toLowerCase());

      let weekNum = existingDb ? existingDb.weekNumber : 1;
      if (!existingDb) {
        // Estimate weekNumber based on latest in DB or chronological order
        const maxDbWeek = existingDbReports.reduce((max, r) => Math.max(max, r.weekNumber), 0);
        weekNum = maxDbWeek > 0 ? maxDbWeek + 1 : 1;
      }

      allParsedReports.push({
        jobSite: site,
        periodName: p.periodName,
        year: p.year,
        month: p.month,
        startDay: p.startDay,
        endDay: p.endDay,
        startDate: sDateStr,
        endDate: eDateStr,
        weekNumber: weekNum,
        isExistingInDb: !!existingDb,
        existingReportId: existingDb?.id,
        pengurangPeriodName: pengurangName,
        produksi: {
          rawBudget: rawProdBudget,
          rawRealisasi: rawProdReal,
          pengurangBudget: pengurangProdBudget,
          pengurangRealisasi: pengurangProdReal,
          weeklyBudget: weeklyProdBudget,
          weeklyRealisasi: weeklyProdReal,
          ytdBudget: ytdProdBudget,
          ytdRealisasi: ytdProdReal,
        },
        biayaProduksi: {
          rawBudget: rawTotalBiayaBudget,
          rawRealisasi: rawTotalBiayaReal,
          pengurangBudget: pengurangTotalBiayaBudget,
          pengurangRealisasi: pengurangTotalBiayaReal,
          weeklyBudget: weeklyTotalBiayaBudget,
          weeklyRealisasi: weeklyTotalBiayaReal,
          ytdBudget: p.ytdBudgetCol ? ytdTotalBiayaBudget : null,
          ytdRealisasi: p.ytdRealCol ? ytdTotalBiayaReal : null,
        },
        items: reportItems,
      });
    }
  }

  const detectedSites = Array.from(new Set(allParsedReports.map((r) => r.jobSite)));
  const newCount = allParsedReports.filter((r) => !r.isExistingInDb).length;
  const updateCount = allParsedReports.filter((r) => r.isExistingInDb).length;

  return {
    fileName,
    detectedSites,
    reports: allParsedReports,
    summary: {
      totalPeriodsFound: allParsedReports.length,
      newPeriodsCount: newCount,
      updatePeriodsCount: updateCount,
    },
  };
}
