import { prisma } from "./prisma";
import { JobSite } from "../generated/prisma/client";

export const INDO_DAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export const INDO_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/**
 * Normalizes input unit code to Prime Mover code
 * e.g. "401" -> "PM401", "pm 401" -> "PM401", "PM401" -> "PM401"
 */
export function normalizeHeadCode(input: string): string {
  const clean = input.trim().replace(/\s+/g, "").toUpperCase();
  if (/^\d{3}$/.test(clean)) {
    return `PM${clean}`;
  }
  return clean;
}

export function formatIndoDate(dateStr: string): string {
  try {
    const parts = dateStr.split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return `${d} ${INDO_MONTHS[m] || ""} ${y}`;
  } catch {
    return dateStr;
  }
}

export function getIndoDayName(dateStr: string): string {
  try {
    const parts = dateStr.split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m, d);
    return INDO_DAYS[dt.getDay()] || "";
  } catch {
    return "";
  }
}

/**
 * Returns Monday..Sunday date range for a given date (YYYY-MM-DD)
 */
export function getWeekRange(dateInput?: string): {
  startDate: string;
  endDate: string;
  dates: string[];
} {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    return getWeekRange();
  }

  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
  }

  return {
    startDate: dates[0],
    endDate: dates[6],
    dates,
  };
}

/**
 * Generates an inclusive date array up to 90 days
 */
export function getDateRange(startDateStr: string, endDateStr: string): {
  startDate: string;
  endDate: string;
  dates: string[];
} {
  const startParts = (startDateStr || "").split("-").map((p) => parseInt(p, 10));
  const endParts = (endDateStr || "").split("-").map((p) => parseInt(p, 10));
  const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return getWeekRange(startDateStr);
  }

  const dates: string[] = [];
  const cur = new Date(start);
  let count = 0;
  while (cur <= end && count < 90) {
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
    cur.setDate(cur.getDate() + 1);
    count++;
  }

  return {
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    dates,
  };
}

/**
 * Resolves the active date range & fetches trailer map + Prime Mover counts
 */
export async function getTrailerSummaryMap(): Promise<Record<string, string>> {
  const allTrailers = await prisma.masterUnit.findMany({
    where: { category: { not: "Prime Mover" } },
    orderBy: { unitNumber: "asc" },
  });

  const trailerSummaryMap: Record<string, string> = {};
  for (const t of allTrailers) {
    if (!t.headUnitCode) continue;
    const curr = trailerSummaryMap[t.headUnitCode];
    trailerSummaryMap[t.headUnitCode] = curr ? `${curr}, ${t.unitCode}` : t.unitCode;
  }
  return trailerSummaryMap;
}

export async function getSiteUnitPopulations(jobSite: JobSite) {
  const [primeMoverPopulation, totalPopulationAllSites] = await Promise.all([
    prisma.masterUnit.count({
      where: { category: "Prime Mover", status: "Active", jobSite },
    }),
    prisma.masterUnit.count({
      where: { category: "Prime Mover", status: "Active" },
    }),
  ]);
  return { primeMoverPopulation, totalPopulationAllSites };
}

/**
 * Computes next periodic KM and HM targets from a serviceType string & current telemetry
 */
export function computePmTargets(
  serviceType: string,
  currentKm?: number | null,
  currentHm?: number | null
): { nextDueKm: number | null; nextDueHm: number | null } {
  const sUpper = (serviceType || "").toUpperCase();
  let nextDueKm: number | null = null;
  let nextDueHm: number | null = null;

  if (currentKm != null && !isNaN(currentKm)) {
    if (sUpper.includes("48.000") || sUpper.includes("48000") || sUpper.includes("PS3")) {
      nextDueKm = Math.round(currentKm + 48000);
    } else if (sUpper.includes("24.000") || sUpper.includes("24000") || sUpper.includes("PS2")) {
      nextDueKm = Math.round(currentKm + 24000);
    } else if (sUpper.includes("12.000") || sUpper.includes("12000") || sUpper.includes("PS1")) {
      nextDueKm = Math.round(currentKm + 12000);
    }
  }

  if (currentHm != null && !isNaN(currentHm)) {
    if (sUpper.includes("2000") || sUpper.includes("P4")) {
      nextDueHm = Math.round((currentHm + 2000) * 10) / 10;
    } else if (sUpper.includes("1000") || sUpper.includes("P3")) {
      nextDueHm = Math.round((currentHm + 1000) * 10) / 10;
    } else if (sUpper.includes("500") || sUpper.includes("P2")) {
      nextDueHm = Math.round((currentHm + 500) * 10) / 10;
    } else if (sUpper.includes("250") || sUpper.includes("P1")) {
      nextDueHm = Math.round((currentHm + 250) * 10) / 10;
    }
  }

  return { nextDueKm, nextDueHm };
}

