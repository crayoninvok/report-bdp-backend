"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INDO_MONTHS = exports.INDO_DAYS = void 0;
exports.normalizeHeadCode = normalizeHeadCode;
exports.formatIndoDate = formatIndoDate;
exports.getIndoDayName = getIndoDayName;
exports.getWeekRange = getWeekRange;
exports.getDateRange = getDateRange;
exports.getTrailerSummaryMap = getTrailerSummaryMap;
exports.getSiteUnitPopulations = getSiteUnitPopulations;
exports.computePmTargets = computePmTargets;
const prisma_1 = require("./prisma");
exports.INDO_DAYS = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
];
exports.INDO_MONTHS = [
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
function normalizeHeadCode(input) {
    const clean = input.trim().replace(/\s+/g, "").toUpperCase();
    if (/^\d{3}$/.test(clean)) {
        return `PM${clean}`;
    }
    return clean;
}
function formatIndoDate(dateStr) {
    try {
        const parts = dateStr.split("-");
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        return `${d} ${exports.INDO_MONTHS[m] || ""} ${y}`;
    }
    catch {
        return dateStr;
    }
}
function getIndoDayName(dateStr) {
    try {
        const parts = dateStr.split("-");
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dt = new Date(y, m, d);
        return exports.INDO_DAYS[dt.getDay()] || "";
    }
    catch {
        return "";
    }
}
/**
 * Returns Monday..Sunday date range for a given date (YYYY-MM-DD)
 */
function getWeekRange(dateInput) {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) {
        return getWeekRange();
    }
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const dates = [];
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
function getDateRange(startDateStr, endDateStr) {
    const startParts = (startDateStr || "").split("-").map((p) => parseInt(p, 10));
    const endParts = (endDateStr || "").split("-").map((p) => parseInt(p, 10));
    const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return getWeekRange(startDateStr);
    }
    const dates = [];
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
async function getTrailerSummaryMap() {
    const allTrailers = await prisma_1.prisma.masterUnit.findMany({
        where: { category: { in: ["Vessel 1", "Dolly", "Vessel 2"] } },
        orderBy: { unitNumber: "asc" },
    });
    const trailerSummaryMap = {};
    for (const t of allTrailers) {
        if (!t.headUnitCode)
            continue;
        const curr = trailerSummaryMap[t.headUnitCode];
        trailerSummaryMap[t.headUnitCode] = curr ? `${curr}, ${t.unitCode}` : t.unitCode;
    }
    return trailerSummaryMap;
}
async function getSiteUnitPopulations(jobSite) {
    const [primeMoverPopulation, totalPopulationAllSites] = await Promise.all([
        prisma_1.prisma.masterUnit.count({
            where: { category: "Prime Mover", status: "Active", jobSite },
        }),
        prisma_1.prisma.masterUnit.count({
            where: { category: "Prime Mover", status: "Active" },
        }),
    ]);
    return { primeMoverPopulation, totalPopulationAllSites };
}
/**
 * Computes next periodic KM and HM targets from a serviceType string & current telemetry
 */
function computePmTargets(serviceType, currentKm, currentHm) {
    const sUpper = (serviceType || "").toUpperCase();
    let nextDueKm = null;
    let nextDueHm = null;
    if (currentKm != null && !isNaN(currentKm)) {
        if (sUpper.includes("48.000") || sUpper.includes("48000") || sUpper.includes("PS3")) {
            nextDueKm = Math.round(currentKm + 48000);
        }
        else if (sUpper.includes("24.000") || sUpper.includes("24000") || sUpper.includes("PS2")) {
            nextDueKm = Math.round(currentKm + 24000);
        }
        else if (sUpper.includes("12.000") || sUpper.includes("12000") || sUpper.includes("PS1")) {
            nextDueKm = Math.round(currentKm + 12000);
        }
    }
    if (currentHm != null && !isNaN(currentHm)) {
        if (sUpper.includes("2000") || sUpper.includes("P4")) {
            nextDueHm = Math.round((currentHm + 2000) * 10) / 10;
        }
        else if (sUpper.includes("1000") || sUpper.includes("P3")) {
            nextDueHm = Math.round((currentHm + 1000) * 10) / 10;
        }
        else if (sUpper.includes("500") || sUpper.includes("P2")) {
            nextDueHm = Math.round((currentHm + 500) * 10) / 10;
        }
        else if (sUpper.includes("250") || sUpper.includes("P1")) {
            nextDueHm = Math.round((currentHm + 250) * 10) / 10;
        }
    }
    return { nextDueKm, nextDueHm };
}
