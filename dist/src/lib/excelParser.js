"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MONTH_NAMES_ID = exports.MONTH_MAP = void 0;
exports.cleanFloat = cleanFloat;
exports.parsePeriodHeader = parsePeriodHeader;
exports.parseExcelReport = parseExcelReport;
const XLSX = __importStar(require("xlsx"));
const prisma_1 = require("./prisma");
const accounts_1 = require("../constants/accounts");
exports.MONTH_MAP = {
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
exports.MONTH_NAMES_ID = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
function cleanFloat(val) {
    if (val === null || val === undefined)
        return 0.0;
    if (typeof val === "number")
        return isNaN(val) ? 0.0 : val;
    const str = String(val).trim();
    if (str === "" ||
        str.startsWith("#") ||
        str.includes("DIV/0") ||
        str.includes("VALUE") ||
        str.includes("REF") ||
        str === "-") {
        return 0.0;
    }
    const cleanStr = str.replace(/,/g, "");
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0.0 : num;
}
function parsePeriodHeader(headerStr) {
    const trimmed = headerStr.trim();
    if (trimmed.toUpperCase().includes("YTD"))
        return null;
    // Pattern: "01-08 Okt 2026", "1-15 Okt 2026", "01-30 April 2026", etc.
    const match = trimmed.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (!match)
        return null;
    const startDay = parseInt(match[1], 10);
    const endDay = parseInt(match[2], 10);
    const monthKey = match[3].toLowerCase();
    const year = parseInt(match[4], 10);
    const month = exports.MONTH_MAP[monthKey];
    if (!month)
        return null;
    return { startDay, endDay, month, year };
}
/**
 * Parses an uploaded Excel workbook buffer and computes incremental weekly delta
 * by subtracting the previous cumulative period in the month.
 */
async function parseExcelReport(buffer, fileName = "uploaded.xlsx", targetJobSite) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetNames = wb.SheetNames;
    const sitesToProcess = [];
    for (const sName of sheetNames) {
        const upper = sName.toUpperCase();
        if (upper.includes("PL WEEK") && (upper.includes("SNY") || upper.includes("SENYIUR"))) {
            if (!targetJobSite || targetJobSite === "Senyiur") {
                sitesToProcess.push({ site: "Senyiur", sheetName: sName });
            }
        }
        else if (upper.includes("PL WEEK") && (upper.includes("MPH") || upper.includes("MUARA") || upper.includes("PAHU"))) {
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
            }
            else if (upper.includes("MPH") || upper.includes("MUARA")) {
                sitesToProcess.push({ site: "MuaraPahu", sheetName: sName });
            }
        }
    }
    if (sitesToProcess.length === 0 && sheetNames.length > 0) {
        // If only 1 sheet exists, use targetJobSite or default to MuaraPahu
        const defaultSite = targetJobSite || "MuaraPahu";
        sitesToProcess.push({ site: defaultSite, sheetName: sheetNames[0] });
    }
    const allParsedReports = [];
    for (const { site, sheetName } of sitesToProcess) {
        const sheet = wb.Sheets[sheetName];
        if (!sheet)
            continue;
        // 1. Fetch existing reports in DB for this site to determine weekNumbers & DB pengurang
        const existingDbReports = await prisma_1.prisma.weeklyReport.findMany({
            where: { jobSite: site },
            orderBy: [{ year: "asc" }, { weekNumber: "asc" }],
            include: {
                items: true,
            },
        });
        const dbReportMapByPeriod = new Map();
        for (const r of existingDbReports) {
            dbReportMapByPeriod.set(r.periodName.trim().toLowerCase(), r);
        }
        const periodsFound = [];
        // Search up to column 150
        for (let c = 1; c <= 150; c++) {
            const colLetter = XLSX.utils.encode_col(c - 1);
            const cell6 = sheet[`${colLetter}6`];
            if (!cell6 || !cell6.v)
                continue;
            const parsed = parsePeriodHeader(String(cell6.v));
            if (parsed) {
                // Look for adjacent YTD column (typically within next 4-6 columns)
                let ytdBudgetCol = null;
                let ytdRealCol = null;
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
            if (a.year !== b.year)
                return a.year - b.year;
            if (a.month !== b.month)
                return a.month - b.month;
            return a.endDay - b.endDay;
        });
        // 3. Map accounts in row 11 to 96
        const accountRowMap = [];
        const normalizedDefMap = new Map(accounts_1.ACCOUNT_DEFINITIONS.map((d) => [d.name.trim().toLowerCase().replace(/\s+/g, " "), d]));
        for (let r = 11; r <= 96; r++) {
            const nameCell = sheet[`F${r}`];
            if (!nameCell || !nameCell.v)
                continue;
            const normalizedName = String(nameCell.v).trim().toLowerCase().replace(/\s+/g, " ");
            const def = normalizedDefMap.get(normalizedName);
            if (def) {
                accountRowMap.push({ row: r, def });
            }
        }
        const monthCumulativeHistory = new Map();
        for (const p of periodsFound) {
            const monthKey = `${p.year}-${p.month}`;
            if (!monthCumulativeHistory.has(monthKey)) {
                monthCumulativeHistory.set(monthKey, []);
            }
            const historyList = monthCumulativeHistory.get(monthKey);
            // Extract raw Produksi
            const bLetter = XLSX.utils.encode_col(p.budgetCol - 1);
            const rLetter = XLSX.utils.encode_col(p.realCol - 1);
            let rawProdBudget = cleanFloat(sheet[`${bLetter}8`]?.v);
            let rawProdReal = cleanFloat(sheet[`${rLetter}8`]?.v);
            // Smart fallback: If PL Week row 8 is 0, check corresponding PL Summary sheet
            if (rawProdBudget === 0 || (site === "MuaraPahu" && rawProdBudget === 0)) {
                const sumSheetKey = site === "Senyiur" ? "PL Summary 1 OPS (SNY) " : "PL Summary 1 OPS (MPH)";
                const sumSheet = wb.Sheets[sumSheetKey] || wb.Sheets[sumSheetKey.trim()];
                if (sumSheet) {
                    // Month cols in summary
                    const sumColMap = {
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
                        const sumB = cleanFloat(sumSheet[`${sumBLetter}8`]?.v);
                        if (sumB > 0) {
                            rawProdBudget = sumB;
                        }
                        if (rawProdReal === 0) {
                            const sumRLetter = XLSX.utils.encode_col(baseC + 2);
                            const sumR = cleanFloat(sumSheet[`${sumRLetter}8`]?.v);
                            if (sumR > 0) {
                                rawProdReal = sumR;
                            }
                        }
                    }
                }
            }
            let ytdProdBudget = null;
            let ytdProdReal = null;
            if (p.ytdBudgetCol) {
                const ybLetter = XLSX.utils.encode_col(p.ytdBudgetCol - 1);
                ytdProdBudget = cleanFloat(sheet[`${ybLetter}8`]?.v);
            }
            if (p.ytdRealCol) {
                const yrLetter = XLSX.utils.encode_col(p.ytdRealCol - 1);
                ytdProdReal = cleanFloat(sheet[`${yrLetter}8`]?.v);
            }
            // Extract raw items
            const rawAccountBudgetMap = new Map();
            const rawAccountRealMap = new Map();
            const ytdAccountBudgetMap = new Map();
            const ytdAccountRealMap = new Map();
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
            // Check total raw budget from PL Week
            let totalRawBudgetInPL = 0;
            for (const val of rawAccountBudgetMap.values()) {
                totalRawBudgetInPL += val;
            }
            // KHUSUS MUARA PAHU: Jika budget tidak ada pada Laporan PL langsung tarik dari Laporan Summary dan taruh gelondongan di Laporan Cost
            if (site === "MuaraPahu" && totalRawBudgetInPL === 0) {
                let pulledFromSummary = false;
                const mphSumSheetKey = "PL Summary 1 OPS (MPH)";
                const mphSumSheet = wb.Sheets[mphSumSheetKey] || wb.Sheets[mphSumSheetKey.trim()];
                const sumColMapMph = {
                    1: 2, 2: 9, 3: 16, 4: 23, 5: 37, 6: 55, 7: 74, 8: 91, 9: 108, 10: 126,
                };
                const baseCol = sumColMapMph[p.month];
                if (mphSumSheet && baseCol) {
                    const sumBLetter = XLSX.utils.encode_col(baseCol - 1);
                    if (rawProdBudget === 0) {
                        rawProdBudget = cleanFloat(mphSumSheet[`${sumBLetter}8`]?.v);
                    }
                    const summaryRowAccountMap = [
                        { row: 11, name: "BEBAN COMPENSATION AND BENEFIT - SITE" },
                        { row: 12, name: "BEBAN CONSUMABLES" },
                        { row: 13, name: "BEBAN FUEL - PRODUCTION" },
                        { row: 14, name: "BEBAN TYRE" },
                        { row: 15, name: "BEBAN SUB KONTRAKTOR" },
                        { row: 16, name: "BEBAN RENTAL ALAT PRODUKSI" },
                        { row: 17, name: "BEBAN REPAIRS & MAINTENANCE" },
                        { row: 18, name: "BEBAN SPAREPART" },
                        { row: 19, name: "BEBAN TOOLS" },
                        { row: 20, name: "BEBAN OVERHEAD COST - SITE" },
                        { row: 21, name: "BEBAN RENTAL ALAT NON PRODUKSI" },
                        { row: 22, name: "BEBAN MOBILISASI" },
                        { row: 23, name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE" },
                    ];
                    for (const sRow of summaryRowAccountMap) {
                        const bVal = cleanFloat(mphSumSheet[`${sumBLetter}${sRow.row}`]?.v);
                        if (bVal > 0) {
                            rawAccountBudgetMap.set(sRow.name, bVal);
                            pulledFromSummary = true;
                        }
                    }
                }
                // Fallback: If not found in uploaded workbook sheet, check database PLSummaryOps
                if (!pulledFromSummary) {
                    const dbSummary = await prisma_1.prisma.pLSummaryOps.findFirst({
                        where: {
                            jobSite: "MuaraPahu",
                            year: p.year,
                            month: p.month,
                        },
                        include: { items: true },
                    });
                    if (dbSummary) {
                        if (rawProdBudget === 0 && dbSummary.budgetProduksi > 0) {
                            rawProdBudget = dbSummary.budgetProduksi;
                        }
                        for (const sItem of dbSummary.items) {
                            if (sItem.budgetCost > 0 && sItem.accountName.trim().toUpperCase() !== "BIAYA PRODUKSI") {
                                rawAccountBudgetMap.set(sItem.accountName.trim(), sItem.budgetCost);
                                pulledFromSummary = true;
                            }
                        }
                    }
                }
            }
            // Determine Subtrahend (Pengurang)
            // Look for the most recent period in the SAME month before this period's endDay
            let pengurangSnapshot = null;
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
                    return (rDate.getUTCFullYear() === p.year &&
                        rDate.getUTCMonth() + 1 === p.month &&
                        rDate.getUTCDate() < p.endDay);
                });
                if (dbMatchesInMonth.length > 0) {
                    // Sort by endDate descending to get the closest prior period
                    dbMatchesInMonth.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
                    const latestPrior = dbMatchesInMonth[0];
                    const acctBMap = new Map();
                    const acctRMap = new Map();
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
            let pengurangName = null;
            if (pengurangSnapshot) {
                pengurangName = pengurangSnapshot.periodName;
                pengurangProdBudget = pengurangSnapshot.produksiBudget;
                pengurangProdReal = pengurangSnapshot.produksiRealisasi;
            }
            // Guard: If raw budget was not provided (0/empty), weekly delta should not become negative
            let weeklyProdBudget = rawProdBudget === 0 ? 0 : Math.max(0, rawProdBudget - pengurangProdBudget);
            if (site === "MuaraPahu" && weeklyProdBudget === 0 && rawProdBudget > 0) {
                weeklyProdBudget = rawProdBudget;
            }
            const weeklyProdReal = rawProdReal - pengurangProdReal;
            // Build items with deltas
            const reportItems = [];
            let weeklyTotalBiayaBudget = 0;
            let weeklyTotalBiayaReal = 0;
            let rawTotalBiayaBudget = 0;
            let rawTotalBiayaReal = 0;
            let pengurangTotalBiayaBudget = 0;
            let pengurangTotalBiayaReal = 0;
            let ytdTotalBiayaBudget = 0;
            let ytdTotalBiayaReal = 0;
            for (let idx = 0; idx < accounts_1.ACCOUNT_DEFINITIONS.length; idx++) {
                const def = accounts_1.ACCOUNT_DEFINITIONS[idx];
                const rawB = rawAccountBudgetMap.get(def.name) || 0;
                const rawR = rawAccountRealMap.get(def.name) || 0;
                const pengurangB = pengurangSnapshot?.accountBudgetMap.get(def.name) || 0;
                const pengurangR = pengurangSnapshot?.accountRealisasiMap.get(def.name) || 0;
                let weeklyB = rawB === 0 ? 0 : Math.max(0, rawB - pengurangB);
                if (site === "MuaraPahu" && weeklyB === 0 && rawB > 0) {
                    weeklyB = rawB;
                }
                const weeklyR = rawR - pengurangR;
                const ytdB = p.ytdBudgetCol ? (ytdAccountBudgetMap.get(def.name) ?? null) : null;
                const ytdR = p.ytdRealCol ? (ytdAccountRealMap.get(def.name) ?? null) : null;
                if (accounts_1.PARENT_ACCOUNT_NAMES.has(def.name)) {
                    rawTotalBiayaBudget += rawB;
                    rawTotalBiayaReal += rawR;
                    pengurangTotalBiayaBudget += pengurangB;
                    pengurangTotalBiayaReal += pengurangR;
                    weeklyTotalBiayaBudget += weeklyB;
                    weeklyTotalBiayaReal += weeklyR;
                    if (ytdB !== null)
                        ytdTotalBiayaBudget += ytdB;
                    if (ytdR !== null)
                        ytdTotalBiayaReal += ytdR;
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
