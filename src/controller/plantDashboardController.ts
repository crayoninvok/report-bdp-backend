import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { JobSite } from "../generated/prisma/client";
import {
  formatIndoDate,
  getIndoDayName,
  getWeekRange,
  INDO_MONTHS,
} from "../lib/plantHelpers";

type GlScope = "all_plant" | "rm_only" | "tyre_oli_grease";
type PmPeriodMode = "week" | "mtd" | "30d" | "ytd" | "custom";

export type PlantCategoryKey =
  | "TYRE"
  | "SPAREPART"
  | "OLI_GREASE"
  | "CONSUMABLE_TOOLS"
  | "JASA_UNDERCARRIAGE";

const RM_ACCOUNT_CODES = [
  "05110301", // BEBAN SPAREPART
  "05110302", // BEBAN TOOLS
  "05110303", // BEBAN CONSUMABLE
  "05110304", // BEBAN GENERAL SUPPLIES
  "05110305", // BEBAN EKSTERNAL SERVICES
  "05110307", // BEBAN UNDERCARIAGE
] as const;

const TYRE_OLI_GREASE_ACCOUNT_CODES = [
  "05110203", // BEBAN TYRE
  "05110204", // BEBAN OLI
  "05110205", // BEBAN GREASE
] as const;

const ALL_PLANT_ACCOUNT_CODES = [
  ...RM_ACCOUNT_CODES,
  ...TYRE_OLI_GREASE_ACCOUNT_CODES,
] as const;

const PL_PLANT_ACCOUNTS_ALL = new Set([
  "BEBAN TYRE",
  "BEBAN REPAIRS & MAINTENANCE",
  "BEBAN SPAREPART",
  "BEBAN TOOLS",
]);

const PL_PLANT_ACCOUNTS_RM = new Set([
  "BEBAN REPAIRS & MAINTENANCE",
  "BEBAN SPAREPART",
  "BEBAN TOOLS",
]);

const PL_PLANT_ACCOUNTS_TYRE = new Set(["BEBAN TYRE"]);

const CATEGORY_LABELS: Record<PlantCategoryKey, string> = {
  TYRE: "Tyre & Rim",
  SPAREPART: "Sparepart",
  OLI_GREASE: "Oli & Grease",
  CONSUMABLE_TOOLS: "Consumable & Tools",
  JASA_UNDERCARRIAGE: "Jasa & Undercarriage",
};

/** Maps a GL account code into a Plant visualization category and scope group. */
function classifyPlantAccount(accountCode: string): {
  categoryKey: PlantCategoryKey;
  categoryLabel: string;
  scopeGroup: "rm_only" | "tyre_oli_grease";
} {
  switch (accountCode) {
    case "05110203":
      return { categoryKey: "TYRE", categoryLabel: CATEGORY_LABELS.TYRE, scopeGroup: "tyre_oli_grease" };
    case "05110204":
    case "05110205":
      return {
        categoryKey: "OLI_GREASE",
        categoryLabel: CATEGORY_LABELS.OLI_GREASE,
        scopeGroup: "tyre_oli_grease",
      };
    case "05110301":
      return { categoryKey: "SPAREPART", categoryLabel: CATEGORY_LABELS.SPAREPART, scopeGroup: "rm_only" };
    case "05110305":
    case "05110307":
      return {
        categoryKey: "JASA_UNDERCARRIAGE",
        categoryLabel: CATEGORY_LABELS.JASA_UNDERCARRIAGE,
        scopeGroup: "rm_only",
      };
    default:
      return {
        categoryKey: "CONSUMABLE_TOOLS",
        categoryLabel: CATEGORY_LABELS.CONSUMABLE_TOOLS,
        scopeGroup: "rm_only",
      };
  }
}

function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftIsoDays(isoDate: string, deltaDays: number): string {
  const parts = isoDate.split("-").map((p) => parseInt(p, 10));
  const dt = new Date(parts[0], parts[1] - 1, parts[2] + deltaDays, 12, 0, 0);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthRange(year: number, month: number): { startDate: string; endDate: string } {
  const lastDay = new Date(year, month, 0, 12, 0, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function normalizeSiteFilter(raw?: string): {
  site: "ALL" | JobSite;
  glProjectArea: "ALL" | "MPH" | "SNY";
} {
  const upper = (raw || "ALL").trim().toUpperCase();
  if (upper === "MUARAPAHU" || upper === "MUARA_PAHU" || upper === "MPH") {
    return { site: "MuaraPahu", glProjectArea: "MPH" };
  }
  if (upper === "SENYIUR" || upper === "SNY") {
    return { site: "Senyiur", glProjectArea: "SNY" };
  }
  return { site: "ALL", glProjectArea: "ALL" };
}

function normalizeGlScope(raw?: string): GlScope {
  const clean = (raw || "all_plant").trim().toLowerCase();
  if (clean === "rm_only") return "rm_only";
  if (clean === "tyre_oli_grease") return "tyre_oli_grease";
  return "all_plant";
}

function resolvePmWindow(params: {
  pmPeriodRaw?: string;
  pmStartDateRaw?: string;
  pmEndDateRaw?: string;
  year: number;
  month: number;
}): { mode: PmPeriodMode; startDate: string; endDate: string; label: string } {
  const clean = (params.pmPeriodRaw || "mtd").trim().toLowerCase();
  const todayIso = getLocalTodayIso();

  if (clean === "custom" && params.pmStartDateRaw && params.pmEndDateRaw) {
    const start = params.pmStartDateRaw <= params.pmEndDateRaw ? params.pmStartDateRaw : params.pmEndDateRaw;
    const end = params.pmStartDateRaw <= params.pmEndDateRaw ? params.pmEndDateRaw : params.pmStartDateRaw;
    return {
      mode: "custom",
      startDate: start,
      endDate: end,
      label: `${formatIndoDate(start)} - ${formatIndoDate(end)}`,
    };
  }

  if (clean === "week") {
    const wk = getWeekRange(todayIso);
    return {
      mode: "week",
      startDate: wk.startDate,
      endDate: wk.endDate,
      label: `${formatIndoDate(wk.startDate)} - ${formatIndoDate(wk.endDate)}`,
    };
  }

  if (clean === "30d") {
    const start = shiftIsoDays(todayIso, -29);
    const end = shiftIsoDays(todayIso, 3); // include upcoming near-term weekly scheduled days
    return {
      mode: "30d",
      startDate: start,
      endDate: end,
      label: `${formatIndoDate(start)} - ${formatIndoDate(end)}`,
    };
  }

  if (clean === "ytd") {
    const start = `${params.year}-01-01`;
    const end = `${params.year}-12-31`;
    return {
      mode: "ytd",
      startDate: start,
      endDate: end,
      label: `YTD ${params.year} (Jan - Des)`,
    };
  }

  const mRange = getMonthRange(params.year, params.month);
  return {
    mode: "mtd",
    startDate: mRange.startDate,
    endDate: mRange.endDate,
    label: `${INDO_MONTHS[params.month - 1] || params.month} ${params.year}`,
  };
}

/** Extracts clean cost-center / unit key for Plant cost ranking charts. */
function extractCostCenterLabel(costCenter?: string | null, remark?: string | null): string {
  const cc = (costCenter || "").trim().toUpperCase();
  if (cc) return cc;
  const remarkMatch = (remark || "").match(/\b(PM\s*\d{3}|DL\s*\d{3}|ST\s*\d{3}|PLT\s*\d{3})\b/i);
  if (remarkMatch) return remarkMatch[1].replace(/\s+/g, "").toUpperCase();
  return "LAINNYA / UMUM";
}

function classifyAssetCategory(unitCode: string, unitCategory?: string | null): string {
  if (unitCategory) return unitCategory;
  const upper = unitCode.toUpperCase();
  if (upper.startsWith("DL")) return "Dolly";
  if (upper.startsWith("ST")) return "Vessel";
  return "Prime Mover";
}

function extractIntervalBucket(serviceType?: string | null): string {
  const upper = (serviceType || "").toUpperCase();
  if (upper.includes("PS1") || upper.includes("12.000") || upper.includes("12000")) return "PS1 (12K KM)";
  if (upper.includes("PS2") || upper.includes("24.000") || upper.includes("24000")) return "PS2 (24K KM)";
  if (upper.includes("PS3") || upper.includes("48.000") || upper.includes("48000")) return "PS3 (48K KM)";
  if (upper.includes("P4") || upper.includes("2000")) return "P4 (2000 HM)";
  if (upper.includes("P3") || upper.includes("1000")) return "P3 (1000 HM)";
  if (upper.includes("P2") || upper.includes("500")) return "P2 (500 HM)";
  if (upper.includes("P1") || upper.includes("250")) return "P1 (250 HM)";
  return "Lainnya";
}

function formatShortDateTick(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length < 3) return isoDate;
  const mIdx = parseInt(parts[1], 10) - 1;
  return `${parseInt(parts[2], 10)} ${INDO_MONTHS[mIdx] || parts[1]}`;
}

function countPeriodDays(startDate?: Date | null, endDate?: Date | null, fallbackDates?: Set<string>): number {
  if (startDate && endDate) {
    const msPerDay = 86400000;
    const diff = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
    if (diff > 0) return diff;
  }
  return fallbackDates && fallbackDates.size > 0 ? fallbackDates.size : 1;
}

export const plantDashboardController = {
  /**
   * GET /api/plant/dashboard
   * Returns aggregated GL Plant cost analytics (YTD & MTD + PL Budget vs Actual reference)
   * and Preventive Maintenance execution analytics (Periodic Inspection & Periodic Service)
   * designed purely for KPI highlight cards and interactive charts.
   */
  getPlantDashboard: async (req: Request, res: Response) => {
    try {
      const { site, glProjectArea } = normalizeSiteFilter(req.query.site as string | undefined);
      const glScope = normalizeGlScope(req.query.glScope as string | undefined);

      // 1. Discover GL Periods (deduplicated per (year, month) keeping latest upload)
      const allGlPeriods = await prisma.gLPeriod.findMany({
        orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
      });

      const availableYears = Array.from(new Set(allGlPeriods.map((p) => p.year))).sort((a, b) => b - a);
      const requestedYear = parseInt(String(req.query.year || ""), 10);
      const activeYear = !isNaN(requestedYear)
        ? requestedYear
        : availableYears[0] || new Date().getFullYear();

      const yearPeriodsRaw = allGlPeriods
        .filter((p) => p.year === activeYear)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const latestPeriodByMonth = new Map<number, (typeof allGlPeriods)[number]>();
      for (const p of yearPeriodsRaw) {
        if (!latestPeriodByMonth.has(p.month)) {
          latestPeriodByMonth.set(p.month, p);
        }
      }

      const uploadedMonths = Array.from(latestPeriodByMonth.keys()).sort((a, b) => a - b);
      const requestedMonth = parseInt(String(req.query.month || ""), 10);
      const latestUploadedMonth = uploadedMonths[uploadedMonths.length - 1] || new Date().getMonth() + 1;
      const activeMonth =
        !isNaN(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
          ? requestedMonth
          : latestUploadedMonth;

      const ytdPeriods = uploadedMonths
        .filter((m) => m <= activeMonth)
        .map((m) => latestPeriodByMonth.get(m)!);
      const mtdPeriod = latestPeriodByMonth.get(activeMonth) || null;
      const prevUploadedMonths = uploadedMonths.filter((m) => m < activeMonth);
      const prevMonthPeriod =
        prevUploadedMonths.length > 0
          ? latestPeriodByMonth.get(prevUploadedMonths[prevUploadedMonths.length - 1])!
          : null;

      const periodMonthLookup = new Map<string, number>();
      ytdPeriods.forEach((p) => periodMonthLookup.set(p.id, p.month));

      // 2. Determine active Plant account codes from glScope
      const activeAccountCodes: string[] =
        glScope === "rm_only"
          ? [...RM_ACCOUNT_CODES]
          : glScope === "tyre_oli_grease"
          ? [...TYRE_OLI_GREASE_ACCOUNT_CODES]
          : [...ALL_PLANT_ACCOUNT_CODES];

      const ytdPeriodIds = ytdPeriods.map((p) => p.id);

      // Query all Plant-scoped GL transactions once for YTD periods (lightweight fields only)
      const txWhere: any = {
        periodId: { in: ytdPeriodIds },
        accountCode: { in: [...ALL_PLANT_ACCOUNT_CODES] },
      };
      if (glProjectArea !== "ALL") {
        txWhere.projectArea = glProjectArea;
      }

      const rawTransactions =
        ytdPeriodIds.length > 0
          ? await prisma.gLTransaction.findMany({
              where: txWhere,
              select: {
                periodId: true,
                date: true,
                accountCode: true,
                accountName: true,
                costCenter: true,
                debet: true,
                projectArea: true,
                remark: true,
              },
            })
          : [];

      // 3. Aggregate GL YTD, MTD, Monthly Trend, Daily MTD Trend, Category & Cost Center
      let ytdTotal = 0;
      let ytdRmTotal = 0;
      let ytdTyreOliGreaseTotal = 0;
      let ytdMph = 0;
      let ytdSny = 0;
      let ytdHof = 0;
      let ytdTxCount = 0;

      let mtdTotal = 0;
      let mtdRmTotal = 0;
      let mtdTyreOliGreaseTotal = 0;
      let mtdMph = 0;
      let mtdSny = 0;
      let mtdHof = 0;
      let mtdTxCount = 0;

      let prevMonthTotal = 0;
      const prevMonthDates = new Set<string>();
      const mtdDatesSet = new Set<string>();

      const emptyCatBuckets = () => ({
        TYRE: 0,
        SPAREPART: 0,
        OLI_GREASE: 0,
        CONSUMABLE_TOOLS: 0,
        JASA_UNDERCARRIAGE: 0,
      });

      const ytdCategoryTotals = emptyCatBuckets();
      const mtdCategoryTotals = emptyCatBuckets();

      // Pre-initialize all months 1..activeMonth for YTD GL chart
      const monthlyGlMap = new Map<
        number,
        {
          month: number;
          label: string;
          hasData: boolean;
          periodName: string | null;
          tyre: number;
          sparepart: number;
          oliGrease: number;
          consumableTools: number;
          jasaUndercarriage: number;
          total: number;
          mph: number;
          sny: number;
          txCount: number;
        }
      >();
      for (let m = 1; m <= activeMonth; m++) {
        const p = latestPeriodByMonth.get(m);
        monthlyGlMap.set(m, {
          month: m,
          label: INDO_MONTHS[m - 1] || `M${m}`,
          hasData: Boolean(p),
          periodName: p?.periodName || null,
          tyre: 0,
          sparepart: 0,
          oliGrease: 0,
          consumableTools: 0,
          jasaUndercarriage: 0,
          total: 0,
          mph: 0,
          sny: 0,
          txCount: 0,
        });
      }

      const dailyMtdMap = new Map<
        string,
        {
          date: string;
          label: string;
          tyre: number;
          sparepart: number;
          oliGrease: number;
          consumableTools: number;
          jasaUndercarriage: number;
          total: number;
          txCount: number;
        }
      >();

      const accountAccMap = new Map<
        string,
        {
          accountCode: string;
          accountName: string;
          categoryKey: PlantCategoryKey;
          categoryLabel: string;
          ytdTotal: number;
          mtdTotal: number;
          ytdMph: number;
          ytdSny: number;
          mtdMph: number;
          mtdSny: number;
          txCountYtd: number;
          txCountMtd: number;
        }
      >();

      const costCenterYtdMap = new Map<
        string,
        {
          costCenter: string;
          tyre: number;
          sparepartRm: number;
          oliGrease: number;
          total: number;
          txCount: number;
        }
      >();
      const costCenterMtdMap = new Map<
        string,
        {
          costCenter: string;
          tyre: number;
          sparepartRm: number;
          oliGrease: number;
          total: number;
          txCount: number;
        }
      >();

      const activeCodeSet = new Set(activeAccountCodes);

      for (const tx of rawTransactions) {
        const accountCode = (tx.accountCode || "").trim();
        const accountName = (tx.accountName || accountCode).trim();
        const amount = tx.debet || 0;
        const { categoryKey, categoryLabel, scopeGroup } = classifyPlantAccount(accountCode);
        const area = (tx.projectArea || "MPH").toUpperCase();
        const isMtd = Boolean(mtdPeriod && tx.periodId === mtdPeriod.id);
        const isPrevMonth = Boolean(prevMonthPeriod && tx.periodId === prevMonthPeriod.id);
        const txMonth = periodMonthLookup.get(tx.periodId);

        // Always accumulate top-level R&M vs Tyre/Oli/Grease totals so highlight chips show split
        if (scopeGroup === "rm_only") ytdRmTotal += amount;
        else ytdTyreOliGreaseTotal += amount;

        if (isMtd) {
          if (scopeGroup === "rm_only") mtdRmTotal += amount;
          else mtdTyreOliGreaseTotal += amount;
        }

        // Remaining GL charts respect active glScope filter
        if (!activeCodeSet.has(accountCode)) continue;

        ytdTotal += amount;
        ytdTxCount += 1;
        if (area === "MPH") ytdMph += amount;
        else if (area === "SNY") ytdSny += amount;
        else ytdHof += amount;
        ytdCategoryTotals[categoryKey] += amount;

        if (isPrevMonth) {
          prevMonthTotal += amount;
          if (tx.date) prevMonthDates.add(tx.date);
        }

        if (txMonth && monthlyGlMap.has(txMonth)) {
          const mEntry = monthlyGlMap.get(txMonth)!;
          mEntry.total += amount;
          mEntry.txCount += 1;
          if (area === "MPH") mEntry.mph += amount;
          else if (area === "SNY") mEntry.sny += amount;
          if (categoryKey === "TYRE") mEntry.tyre += amount;
          else if (categoryKey === "SPAREPART") mEntry.sparepart += amount;
          else if (categoryKey === "OLI_GREASE") mEntry.oliGrease += amount;
          else if (categoryKey === "CONSUMABLE_TOOLS") mEntry.consumableTools += amount;
          else mEntry.jasaUndercarriage += amount;
        }

        if (isMtd) {
          mtdTotal += amount;
          mtdTxCount += 1;
          if (area === "MPH") mtdMph += amount;
          else if (area === "SNY") mtdSny += amount;
          else mtdHof += amount;
          mtdCategoryTotals[categoryKey] += amount;
          if (tx.date) mtdDatesSet.add(tx.date);

          if (tx.date) {
            if (!dailyMtdMap.has(tx.date)) {
              dailyMtdMap.set(tx.date, {
                date: tx.date,
                label: formatShortDateTick(tx.date),
                tyre: 0,
                sparepart: 0,
                oliGrease: 0,
                consumableTools: 0,
                jasaUndercarriage: 0,
                total: 0,
                txCount: 0,
              });
            }
            const dEntry = dailyMtdMap.get(tx.date)!;
            dEntry.total += amount;
            dEntry.txCount += 1;
            if (categoryKey === "TYRE") dEntry.tyre += amount;
            else if (categoryKey === "SPAREPART") dEntry.sparepart += amount;
            else if (categoryKey === "OLI_GREASE") dEntry.oliGrease += amount;
            else if (categoryKey === "CONSUMABLE_TOOLS") dEntry.consumableTools += amount;
            else dEntry.jasaUndercarriage += amount;
          }
        }

        // Per-account totals
        if (!accountAccMap.has(accountCode)) {
          accountAccMap.set(accountCode, {
            accountCode,
            accountName,
            categoryKey,
            categoryLabel,
            ytdTotal: 0,
            mtdTotal: 0,
            ytdMph: 0,
            ytdSny: 0,
            mtdMph: 0,
            mtdSny: 0,
            txCountYtd: 0,
            txCountMtd: 0,
          });
        }
        const accEntry = accountAccMap.get(accountCode)!;
        accEntry.ytdTotal += amount;
        accEntry.txCountYtd += 1;
        if (area === "MPH") accEntry.ytdMph += amount;
        else if (area === "SNY") accEntry.ytdSny += amount;
        if (isMtd) {
          accEntry.mtdTotal += amount;
          accEntry.txCountMtd += 1;
          if (area === "MPH") accEntry.mtdMph += amount;
          else if (area === "SNY") accEntry.mtdSny += amount;
        }

        // Cost Center ranking (YTD & MTD)
        const ccLabel = extractCostCenterLabel(tx.costCenter, tx.remark);
        const pushCc = (
          map: Map<
            string,
            { costCenter: string; tyre: number; sparepartRm: number; oliGrease: number; total: number; txCount: number }
          >
        ) => {
          if (!map.has(ccLabel)) {
            map.set(ccLabel, {
              costCenter: ccLabel,
              tyre: 0,
              sparepartRm: 0,
              oliGrease: 0,
              total: 0,
              txCount: 0,
            });
          }
          const cEntry = map.get(ccLabel)!;
          cEntry.total += amount;
          cEntry.txCount += 1;
          if (categoryKey === "TYRE") cEntry.tyre += amount;
          else if (categoryKey === "OLI_GREASE") cEntry.oliGrease += amount;
          else cEntry.sparepartRm += amount;
        };
        pushCc(costCenterYtdMap);
        if (isMtd) pushCc(costCenterMtdMap);
      }

      const mtdDays = mtdPeriod
        ? countPeriodDays(mtdPeriod.startDate, mtdPeriod.endDate, mtdDatesSet)
        : 0;
      const mtdAvgDaily = mtdDays > 0 ? Math.round(mtdTotal / mtdDays) : 0;

      const prevMonthDays = prevMonthPeriod
        ? countPeriodDays(prevMonthPeriod.startDate, prevMonthPeriod.endDate, prevMonthDates)
        : 0;
      const prevMonthAvgDaily = prevMonthDays > 0 ? Math.round(prevMonthTotal / prevMonthDays) : 0;
      const dailyRunRateDeltaPercent =
        prevMonthAvgDaily > 0
          ? Math.round(((mtdAvgDaily - prevMonthAvgDaily) / prevMonthAvgDaily) * 1000) / 10
          : null;

      // Build daily MTD timeline sorted chronologically with cumulative running total
      const dailyMtdSorted = Array.from(dailyMtdMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      let runningCum = 0;
      const dailyMtdTrend = dailyMtdSorted.map((d) => {
        runningCum += d.total;
        return {
          ...d,
          tyre: Math.round(d.tyre),
          sparepart: Math.round(d.sparepart),
          oliGrease: Math.round(d.oliGrease),
          consumableTools: Math.round(d.consumableTools),
          jasaUndercarriage: Math.round(d.jasaUndercarriage),
          total: Math.round(d.total),
          cumulativeTotal: Math.round(runningCum),
        };
      });

      const categoryBreakdown = (Object.keys(CATEGORY_LABELS) as PlantCategoryKey[])
        .map((key) => ({
          categoryKey: key,
          categoryLabel: CATEGORY_LABELS[key],
          ytdTotal: Math.round(ytdCategoryTotals[key]),
          mtdTotal: Math.round(mtdCategoryTotals[key]),
          ytdSharePercent:
            ytdTotal > 0 ? Math.round((ytdCategoryTotals[key] / ytdTotal) * 1000) / 10 : 0,
          mtdSharePercent:
            mtdTotal > 0 ? Math.round((mtdCategoryTotals[key] / mtdTotal) * 1000) / 10 : 0,
        }))
        .filter((c) => c.ytdTotal > 0 || c.mtdTotal > 0)
        .sort((a, b) => b.ytdTotal - a.ytdTotal);

      const accountBreakdown = Array.from(accountAccMap.values())
        .map((a) => ({
          ...a,
          ytdTotal: Math.round(a.ytdTotal),
          mtdTotal: Math.round(a.mtdTotal),
          ytdMph: Math.round(a.ytdMph),
          ytdSny: Math.round(a.ytdSny),
          mtdMph: Math.round(a.mtdMph),
          mtdSny: Math.round(a.mtdSny),
        }))
        .sort((a, b) => b.ytdTotal - a.ytdTotal);

      const formatTopCostCenters = (
        map: Map<
          string,
          { costCenter: string; tyre: number; sparepartRm: number; oliGrease: number; total: number; txCount: number }
        >
      ) =>
        Array.from(map.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)
          .map((c) => ({
            ...c,
            tyre: Math.round(c.tyre),
            sparepartRm: Math.round(c.sparepartRm),
            oliGrease: Math.round(c.oliGrease),
            total: Math.round(c.total),
          }));

      // 4. PL Summary Reference (Jan..activeMonth Budget vs Realisasi for Plant Accounts)
      const plAccountSet =
        glScope === "rm_only"
          ? PL_PLANT_ACCOUNTS_RM
          : glScope === "tyre_oli_grease"
          ? PL_PLANT_ACCOUNTS_TYRE
          : PL_PLANT_ACCOUNTS_ALL;

      const plRows = await prisma.pLSummaryOps.findMany({
        where: {
          year: activeYear,
          month: { lte: activeMonth },
          ...(site !== "ALL" ? { jobSite: site } : {}),
        },
        include: { items: true },
        orderBy: [{ month: "asc" }],
      });

      const plByMonth = new Map<
        number,
        {
          month: number;
          label: string;
          budget: number;
          realisasi: number;
          tyreBudget: number;
          tyreReal: number;
          rmBudget: number;
          rmReal: number;
        }
      >();

      let plYtdBudget = 0;
      let plYtdReal = 0;
      let plMtdBudget = 0;
      let plMtdReal = 0;

      for (const row of plRows) {
        if (!plByMonth.has(row.month)) {
          plByMonth.set(row.month, {
            month: row.month,
            label: row.monthLabel || INDO_MONTHS[row.month - 1] || `M${row.month}`,
            budget: 0,
            realisasi: 0,
            tyreBudget: 0,
            tyreReal: 0,
            rmBudget: 0,
            rmReal: 0,
          });
        }
        const bucket = plByMonth.get(row.month)!;

        for (const item of row.items) {
          const accUpper = item.accountName.trim().toUpperCase();
          if (!plAccountSet.has(accUpper)) continue;
          const b = Math.max(0, item.budgetCost || 0);
          const r = Math.max(0, item.realisasiCost || 0);

          bucket.budget += b;
          bucket.realisasi += r;
          if (accUpper === "BEBAN TYRE") {
            bucket.tyreBudget += b;
            bucket.tyreReal += r;
          } else {
            bucket.rmBudget += b;
            bucket.rmReal += r;
          }

          plYtdBudget += b;
          plYtdReal += r;
          if (row.month === activeMonth) {
            plMtdBudget += b;
            plMtdReal += r;
          }
        }
      }

      const plMonthlyTrend = Array.from(plByMonth.values())
        .sort((a, b) => a.month - b.month)
        .map((m) => ({
          ...m,
          budget: Math.round(m.budget),
          realisasi: Math.round(m.realisasi),
          tyreBudget: Math.round(m.tyreBudget),
          tyreReal: Math.round(m.tyreReal),
          rmBudget: Math.round(m.rmBudget),
          rmReal: Math.round(m.rmReal),
          achPercent: m.budget > 0 ? Math.round((m.realisasi / m.budget) * 1000) / 10 : 0,
          variance: Math.round(m.budget - m.realisasi),
        }));

      // 5. Preventive Maintenance (Periodic Inspection & Periodic Service)
      const pmWindow = resolvePmWindow({
        pmPeriodRaw: req.query.pmPeriod as string | undefined,
        pmStartDateRaw: req.query.pmStartDate as string | undefined,
        pmEndDateRaw: req.query.pmEndDate as string | undefined,
        year: activeYear,
        month: activeMonth,
      });

      const pmDateWhere = { gte: pmWindow.startDate, lte: pmWindow.endDate };
      const siteWhere = site !== "ALL" ? { jobSite: site } : {};

      const [
        piPlans,
        psPlans,
        piTargetSetting,
        psTargetSetting,
        primeMoversBySite,
        totalUnitsCount,
      ] = await Promise.all([
        prisma.periodicInspectionPlan.findMany({
          where: { date: pmDateWhere, ...siteWhere },
          include: { items: true },
          orderBy: [{ date: "asc" }],
        }),
        prisma.preventiveMaintenancePlan.findMany({
          where: { date: pmDateWhere, ...siteWhere },
          include: {
            items: {
              include: { unit: { select: { category: true, jobSite: true } } },
            },
          },
          orderBy: [{ date: "asc" }],
        }),
        prisma.plantSetting.findUnique({ where: { key: "daily_pi_target" } }),
        prisma.plantSetting.findUnique({ where: { key: "daily_pm_target" } }),
        prisma.masterUnit.groupBy({
          by: ["jobSite"],
          where: { category: "Prime Mover", status: "Active", ...siteWhere },
          _count: { id: true },
        }),
        prisma.masterUnit.count({
          where: { status: "Active", ...siteWhere },
        }),
      ]);

      const defaultPiTarget = piTargetSetting ? parseInt(piTargetSetting.value, 10) || 9 : 9;
      const defaultPsTarget = psTargetSetting ? parseInt(psTargetSetting.value, 10) || 4 : 4;
      const primeMoverPopulation = primeMoversBySite.reduce((sum, s) => sum + s._count.id, 0);

      // Build PI date-level aggregation
      const buildPlanSeries = <
        TItem extends { status: string; shift: string; serviceType?: string | null },
        TPlan extends { date: string; targetUnits: number; items: TItem[] }
      >(
        plans: TPlan[],
        fallbackDailyTarget: number
      ) => {
        const byDate = new Map<
          string,
          { date: string; targetUnits: number; items: TItem[] }
        >();

        for (const p of plans) {
          if (!byDate.has(p.date)) {
            byDate.set(p.date, { date: p.date, targetUnits: 0, items: [] });
          }
          const bucket = byDate.get(p.date)!;
          bucket.targetUnits += p.targetUnits ?? fallbackDailyTarget;
          bucket.items.push(...p.items);
        }

        // For `week` mode, guarantee all 7 Mon-Sun dates appear even if unscheduled yet
        if (pmWindow.mode === "week") {
          const wk = getWeekRange(pmWindow.startDate);
          for (const dStr of wk.dates) {
            if (!byDate.has(dStr)) {
              byDate.set(dStr, { date: dStr, targetUnits: fallbackDailyTarget, items: [] });
            }
          }
        }

        const statusCounts = {
          Completed: 0,
          "In Progress": 0,
          Scheduled: 0,
          Pending: 0,
        };
        const shiftMap = new Map<string, { shift: string; total: number; completed: number; pending: number }>();

        let totalPlan = 0;
        let totalScheduled = 0;
        let totalCompleted = 0;

        const dailySeries = Array.from(byDate.values())
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((d) => {
            let completed = 0;
            let inProgress = 0;
            let scheduled = 0;
            let pending = 0;

            for (const it of d.items) {
              if (it.status === "Completed") completed++;
              else if (it.status === "In Progress") inProgress++;
              else if (it.status === "Pending") pending++;
              else scheduled++;

              const stKey = (it.status in statusCounts ? it.status : "Scheduled") as keyof typeof statusCounts;
              statusCounts[stKey] += 1;

              const shName = it.shift || "Shift 1";
              if (!shiftMap.has(shName)) {
                shiftMap.set(shName, { shift: shName, total: 0, completed: 0, pending: 0 });
              }
              const sBucket = shiftMap.get(shName)!;
              sBucket.total += 1;
              if (it.status === "Completed") sBucket.completed += 1;
              else sBucket.pending += 1;
            }

            const countScheduled = d.items.length;
            const planTarget = d.targetUnits > 0 ? d.targetUnits : fallbackDailyTarget;
            totalPlan += planTarget;
            totalScheduled += countScheduled;
            totalCompleted += completed;

            return {
              date: d.date,
              label:
                pmWindow.mode === "week"
                  ? `${getIndoDayName(d.date).slice(0, 3)}, ${formatShortDateTick(d.date)}`
                  : formatShortDateTick(d.date),
              plan: planTarget,
              scheduled: countScheduled,
              completed,
              inProgress,
              openCount: scheduled + pending,
              achievementPercent:
                planTarget > 0 ? Math.round((completed / planTarget) * 1000) / 10 : 0,
            };
          });

        const achievementPercent =
          totalPlan > 0 ? Math.round((totalCompleted / totalPlan) * 1000) / 10 : 0;
        const scheduleFillPercent =
          totalPlan > 0 ? Math.round((totalScheduled / totalPlan) * 1000) / 10 : 0;

        return {
          summary: {
            totalPlan,
            totalScheduled,
            totalCompleted,
            inProgressCount: statusCounts["In Progress"],
            scheduledOpenCount: statusCounts.Scheduled,
            pendingCount: statusCounts.Pending,
            achievementPercent,
            scheduleFillPercent,
            daysCount: dailySeries.length,
          },
          statusBreakdown: [
            { name: "Completed", value: statusCounts.Completed, key: "Completed" },
            { name: "In Progress", value: statusCounts["In Progress"], key: "In Progress" },
            { name: "Scheduled", value: statusCounts.Scheduled, key: "Scheduled" },
            { name: "Pending", value: statusCounts.Pending, key: "Pending" },
          ].filter((s) => s.value > 0),
          shiftBreakdown: Array.from(shiftMap.values()).sort((a, b) =>
            a.shift.localeCompare(b.shift)
          ),
          dailySeries,
        };
      };

      const piAggregated = buildPlanSeries(piPlans, defaultPiTarget);
      const psAggregated = buildPlanSeries(psPlans, defaultPsTarget);

      // Extra PS analytics: Interval breakdown (PS1/PS2/PS3/P1-P4) & Asset category breakdown + KPI items
      const intervalMap = new Map<
        string,
        { interval: string; Completed: number; "In Progress": number; Scheduled: number; Pending: number; total: number }
      >();
      const assetCategoryMap = new Map<
        string,
        { assetCategory: string; total: number; completed: number }
      >();

      const psKpiItems = psPlans.flatMap((p) =>
        p.items.map((it) => {
          const interval = extractIntervalBucket(it.serviceType);
          if (!intervalMap.has(interval)) {
            intervalMap.set(interval, {
              interval,
              Completed: 0,
              "In Progress": 0,
              Scheduled: 0,
              Pending: 0,
              total: 0,
            });
          }
          const iBucket = intervalMap.get(interval)!;
          iBucket.total += 1;
          if (it.status === "Completed") iBucket.Completed += 1;
          else if (it.status === "In Progress") iBucket["In Progress"] += 1;
          else if (it.status === "Pending") iBucket.Pending += 1;
          else iBucket.Scheduled += 1;

          const assetCat = classifyAssetCategory(it.unitCode, it.unit?.category);
          if (!assetCategoryMap.has(assetCat)) {
            assetCategoryMap.set(assetCat, { assetCategory: assetCat, total: 0, completed: 0 });
          }
          const aBucket = assetCategoryMap.get(assetCat)!;
          aBucket.total += 1;
          if (it.status === "Completed") aBucket.completed += 1;

          return {
            id: it.id,
            planId: it.planId,
            date: it.date,
            unitCode: it.unitCode,
            serviceType: it.serviceType,
            shift: it.shift,
            status: it.status,
            category: it.category,
            planStartTime: it.planStartTime,
            planLeadTime: it.planLeadTime,
            planHmServis: it.planHmServis,
            actualStartTime: it.actualStartTime,
            actualLeadTime: it.actualLeadTime,
            actualHmServis: it.actualHmServis,
          };
        })
      );

      const intervalOrder = [
        "PS1 (12K KM)",
        "PS2 (24K KM)",
        "PS3 (48K KM)",
        "P1 (250 HM)",
        "P2 (500 HM)",
        "P3 (1000 HM)",
        "P4 (2000 HM)",
        "Lainnya",
      ];

      const psIntervalBreakdown = Array.from(intervalMap.values()).sort(
        (a, b) => intervalOrder.indexOf(a.interval) - intervalOrder.indexOf(b.interval)
      );

      const psAssetBreakdown = Array.from(assetCategoryMap.values()).sort(
        (a, b) => b.total - a.total
      );

      return res.json({
        success: true,
        data: {
          filters: {
            site,
            glProjectArea,
            glScope,
            year: activeYear,
            month: activeMonth,
            availableYears,
            availableMonths: uploadedMonths.map((m) => {
              const p = latestPeriodByMonth.get(m)!;
              return {
                month: m,
                label: `${INDO_MONTHS[m - 1] || m} ${p.year}`,
                periodName: p.periodName,
                startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
                endDate: p.endDate ? p.endDate.toISOString().slice(0, 10) : null,
              };
            }),
            pmPeriod: pmWindow.mode,
            pmRange: {
              startDate: pmWindow.startDate,
              endDate: pmWindow.endDate,
              label: pmWindow.label,
            },
          },
          fleet: {
            primeMoverPopulation,
            totalUnitsCount,
          },
          glCost: {
            ytd: {
              totalCost: Math.round(ytdTotal),
              rmCost: Math.round(ytdRmTotal),
              tyreOliGreaseCost: Math.round(ytdTyreOliGreaseTotal),
              mphCost: Math.round(ytdMph),
              snyCost: Math.round(ytdSny),
              hofCost: Math.round(ytdHof),
              transactionCount: ytdTxCount,
              uploadedMonthsCount: ytdPeriods.length,
              uploadedPeriodNames: ytdPeriods.map((p) => p.periodName),
              uploadedMonthsLabel: ytdPeriods
                .map((p) => INDO_MONTHS[p.month - 1] || String(p.month))
                .join(", "),
            },
            mtd: {
              hasData: Boolean(mtdPeriod),
              periodName: mtdPeriod?.periodName || `Belum ada upload GL (${INDO_MONTHS[activeMonth - 1]} ${activeYear})`,
              startDate: mtdPeriod?.startDate ? mtdPeriod.startDate.toISOString().slice(0, 10) : null,
              endDate: mtdPeriod?.endDate ? mtdPeriod.endDate.toISOString().slice(0, 10) : null,
              daysElapsed: mtdDays,
              totalCost: Math.round(mtdTotal),
              rmCost: Math.round(mtdRmTotal),
              tyreOliGreaseCost: Math.round(mtdTyreOliGreaseTotal),
              mphCost: Math.round(mtdMph),
              snyCost: Math.round(mtdSny),
              hofCost: Math.round(mtdHof),
              avgDailyCost: mtdAvgDaily,
              prevMonthPeriodName: prevMonthPeriod?.periodName || null,
              prevMonthAvgDaily,
              dailyRunRateDeltaPercent,
              transactionCount: mtdTxCount,
            },
            monthlyGlTrend: Array.from(monthlyGlMap.values()).map((m) => ({
              ...m,
              tyre: Math.round(m.tyre),
              sparepart: Math.round(m.sparepart),
              oliGrease: Math.round(m.oliGrease),
              consumableTools: Math.round(m.consumableTools),
              jasaUndercarriage: Math.round(m.jasaUndercarriage),
              total: Math.round(m.total),
              mph: Math.round(m.mph),
              sny: Math.round(m.sny),
            })),
            dailyMtdTrend,
            categoryBreakdown,
            accountBreakdown,
            topCostCentersYtd: formatTopCostCenters(costCenterYtdMap),
            topCostCentersMtd: formatTopCostCenters(costCenterMtdMap),
            plReference: {
              totals: {
                ytdBudget: Math.round(plYtdBudget),
                ytdRealisasi: Math.round(plYtdReal),
                ytdVariance: Math.round(plYtdBudget - plYtdReal),
                ytdAchPercent:
                  plYtdBudget > 0 ? Math.round((plYtdReal / plYtdBudget) * 1000) / 10 : 0,
                mtdBudget: Math.round(plMtdBudget),
                mtdRealisasi: Math.round(plMtdReal),
              },
              monthlyTrend: plMonthlyTrend,
            },
          },
          pm: {
            pi: piAggregated,
            ps: {
              ...psAggregated,
              intervalBreakdown: psIntervalBreakdown,
              assetBreakdown: psAssetBreakdown,
              kpiItems: psKpiItems,
            },
          },
        },
      });
    } catch (error: any) {
      console.error("getPlantDashboard error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Gagal memuat data Dashboard Plant.",
      });
    }
  },
};
