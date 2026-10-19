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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateUA = exports.uploadExcelProduction = exports.syncBundledExcel = exports.deleteDailyProduction = exports.updateDailyProduction = exports.createDailyProduction = exports.getProductionStats = exports.getDailyProductions = exports.PRODUCTION_TARGETS = void 0;
exports.calculateWeekNumber = calculateWeekNumber;
const prisma_1 = require("../lib/prisma");
const client_1 = require("../generated/prisma/client");
const path_1 = __importDefault(require("path"));
const xlsx = __importStar(require("xlsx"));
const fs_1 = __importDefault(require("fs"));
/**
 * Standard KPI Production Targets from Excel "KPI . Anual 2026 Wajib Input Daily + UA.xlsx"
 */
exports.PRODUCTION_TARGETS = {
    pa: 0.93, // 93%
    ua: 0.88, // 88%
    payload: 205.0, // Ton per truck
    cycleTime: 7.5, // Jam (target efisiensi)
    fuelRatio: 1.55, // L/Ton
    unitRunning: 43, // Unit armada aktif
    tdp: 2.7, // Trip per Day per unit
    dailyProductionBase: 13266.67, // Ton/hari dasar
    dailyProductionQ4: 21645.16, // Ton/hari target Okt-Des
    monthlyProductionBase: 398000, // Ton/bulan dasar
    monthlyProductionTarget: 671000, // Ton/bulan target Okt-Des
};
/**
 * Calculate standard week number (W01-W53) based on Excel formula:
 * ="W"&TEXT(INT((date - DATE(2026,1,1))/7)+1,"00")
 */
function calculateWeekNumber(dateStr) {
    try {
        const parts = dateStr.split("-").map(Number);
        if (parts.length === 3) {
            const year = parts[0];
            const month = parts[1] - 1;
            const day = parts[2];
            const date = new Date(Date.UTC(year, month, day));
            const startOfYear = new Date(Date.UTC(year, 0, 1));
            const diffMs = date.getTime() - startOfYear.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const weekNum = Math.floor(diffDays / 7) + 1;
            const clamped = Math.min(53, Math.max(1, weekNum));
            return `W${String(clamped).padStart(2, "0")}`;
        }
    }
    catch (e) {
        // fallback
    }
    return "W01";
}
/**
 * Normalize decimal or percentage values (e.g. 95.8% -> 0.958)
 */
function normalizeRate(val, defaultVal = 0) {
    if (val === undefined || val === null || val === "")
        return defaultVal;
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));
    if (isNaN(num))
        return defaultVal;
    return num > 1.0 ? num / 100 : num;
}
function parseNum(val, defaultVal = 0) {
    if (val === undefined || val === null || val === "")
        return defaultVal;
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));
    return isNaN(num) ? defaultVal : num;
}
/**
 * GET /api/production/daily
 * Get daily production records with filters
 */
const getDailyProductions = async (req, res) => {
    try {
        const { site, weekNumber, month, year, startDate, endDate, search } = req.query;
        const where = {};
        if (site && typeof site === "string" && site !== "all") {
            where.jobSite = site;
        }
        if (weekNumber && typeof weekNumber === "string" && weekNumber !== "all") {
            where.weekNumber = weekNumber.toUpperCase();
        }
        if (startDate && endDate) {
            where.date = {
                gte: String(startDate),
                lte: String(endDate),
            };
        }
        else if (startDate) {
            where.date = { gte: String(startDate) };
        }
        else if (endDate) {
            where.date = { lte: String(endDate) };
        }
        else if (month && year) {
            const mStr = String(month).padStart(2, "0");
            where.date = {
                startsWith: `${year}-${mStr}`,
            };
        }
        else if (year) {
            where.date = {
                startsWith: `${year}-`,
            };
        }
        if (search && typeof search === "string" && search.trim() !== "") {
            const q = search.trim();
            where.OR = [
                { date: { contains: q } },
                { weekNumber: { contains: q, mode: "insensitive" } },
                { notes: { contains: q, mode: "insensitive" } },
            ];
        }
        const records = await prisma_1.prisma.dailyProduction.findMany({
            where,
            orderBy: [{ date: "desc" }],
        });
        res.json({
            success: true,
            count: records.length,
            targets: exports.PRODUCTION_TARGETS,
            data: records,
        });
    }
    catch (error) {
        console.error("Error fetching daily productions:", error);
        res.status(500).json({
            success: false,
            message: "Gagal mengambil data produksi harian",
            error: error.message,
        });
    }
};
exports.getDailyProductions = getDailyProductions;
/**
 * GET /api/production/daily/stats
 * Aggregate KPI statistics, weekly averages, and target comparisons
 */
const getProductionStats = async (req, res) => {
    try {
        const { site, year, month, weekNumber } = req.query;
        const where = {};
        if (site && typeof site === "string" && site !== "all") {
            where.jobSite = site;
        }
        if (weekNumber && typeof weekNumber === "string" && weekNumber !== "all") {
            where.weekNumber = weekNumber.toUpperCase();
        }
        if (month && year) {
            const mStr = String(month).padStart(2, "0");
            where.date = { startsWith: `${year}-${mStr}` };
        }
        else if (year) {
            where.date = { startsWith: `${year}-` };
        }
        const records = await prisma_1.prisma.dailyProduction.findMany({
            where,
            orderBy: [{ date: "asc" }],
        });
        if (records.length === 0) {
            return res.json({
                success: true,
                data: {
                    totalDays: 0,
                    totalProduction: 0,
                    avgProductionDaily: 0,
                    avgPa: 0,
                    avgUa: 0,
                    avgPayload: 0,
                    avgCycleTime: 0,
                    avgFuelRatio: 0,
                    avgUnitRunning: 0,
                    avgTdp: 0,
                    targets: exports.PRODUCTION_TARGETS,
                    weeklyKpis: [],
                    achievement: {
                        paPercent: 0,
                        uaPercent: 0,
                        payloadPercent: 0,
                        cycleTimePercent: 0,
                        fuelRatioPercent: 0,
                        tdpPercent: 0,
                        productionPercent: 0,
                    },
                },
            });
        }
        const totalDays = records.length;
        const totalProduction = records.reduce((acc, r) => acc + r.production, 0);
        const avgProductionDaily = totalProduction / totalDays;
        const avgPa = records.reduce((acc, r) => acc + r.pa, 0) / totalDays;
        const avgUa = records.reduce((acc, r) => acc + r.ua, 0) / totalDays;
        const avgPayload = records.reduce((acc, r) => acc + r.payload, 0) / totalDays;
        const avgCycleTime = records.reduce((acc, r) => acc + r.cycleTime, 0) / totalDays;
        const avgFuelRatio = records.reduce((acc, r) => acc + r.fuelRatio, 0) / totalDays;
        const avgUnitRunning = records.reduce((acc, r) => acc + r.unitRunning, 0) / totalDays;
        const avgTdp = records.reduce((acc, r) => acc + r.tdp, 0) / totalDays;
        // Group by weekNumber for weekly KPI analysis (matching Sheet 'Grafik KPI 2026' & 'Indikator KPI W30-W53')
        const weekMap = new Map();
        records.forEach((r) => {
            const list = weekMap.get(r.weekNumber) || [];
            list.push(r);
            weekMap.set(r.weekNumber, list);
        });
        // In Sheet 'Indikator KPI W30-W53', the active indicator weeks run continuously from W30 to at least W41.
        // Weeks with zero hauling activity (specifically W30 and W34) are explicitly recorded with value 0.
        let maxWeek = 41;
        records.forEach((r) => {
            const num = parseInt(r.weekNumber.replace(/\D/g, ""), 10);
            if (!isNaN(num) && num > maxWeek)
                maxWeek = num;
        });
        const weeklyKpis = [];
        for (let i = 30; i <= maxWeek; i++) {
            const wStr = `W${String(i).padStart(2, "0")}`;
            const weekRecords = weekMap.get(wStr);
            if (weekRecords && weekRecords.length > 0) {
                const count = weekRecords.length;
                const wProd = weekRecords.reduce((acc, r) => acc + r.production, 0);
                const wPa = weekRecords.reduce((acc, r) => acc + r.pa, 0) / count;
                const wUa = weekRecords.reduce((acc, r) => acc + r.ua, 0) / count;
                const wPayload = weekRecords.reduce((acc, r) => acc + r.payload, 0) / count;
                const wCycleTime = weekRecords.reduce((acc, r) => acc + r.cycleTime, 0) / count;
                const wFuelRatio = weekRecords.reduce((acc, r) => acc + r.fuelRatio, 0) / count;
                const wUnit = weekRecords.reduce((acc, r) => acc + r.unitRunning, 0) / count;
                const wTdp = weekRecords.reduce((acc, r) => acc + r.tdp, 0) / count;
                weeklyKpis.push({
                    weekNumber: wStr,
                    daysCount: count,
                    startDate: weekRecords[0].date,
                    endDate: weekRecords[weekRecords.length - 1].date,
                    paActual: Number(wPa.toFixed(4)),
                    paTarget: exports.PRODUCTION_TARGETS.pa,
                    uaActual: Number(wUa.toFixed(4)),
                    uaTarget: exports.PRODUCTION_TARGETS.ua,
                    payloadActual: Number(wPayload.toFixed(2)),
                    payloadTarget: exports.PRODUCTION_TARGETS.payload,
                    cycleTimeActual: Number(wCycleTime.toFixed(2)),
                    cycleTimeTarget: exports.PRODUCTION_TARGETS.cycleTime,
                    fuelRatioActual: Number(wFuelRatio.toFixed(3)),
                    fuelRatioTarget: exports.PRODUCTION_TARGETS.fuelRatio,
                    unitRunningActual: Number(wUnit.toFixed(1)),
                    unitRunningTarget: exports.PRODUCTION_TARGETS.unitRunning,
                    tdpActual: Number(wTdp.toFixed(2)),
                    tdpTarget: exports.PRODUCTION_TARGETS.tdp,
                    productionActual: Number(wProd.toFixed(2)),
                });
            }
            else {
                // Zero-production week (e.g. W30, W34) matching Excel sheet 'Indikator KPI W30-W53'
                weeklyKpis.push({
                    weekNumber: wStr,
                    daysCount: 0,
                    startDate: "",
                    endDate: "",
                    paActual: 0,
                    paTarget: exports.PRODUCTION_TARGETS.pa,
                    uaActual: 0,
                    uaTarget: exports.PRODUCTION_TARGETS.ua,
                    payloadActual: 0,
                    payloadTarget: exports.PRODUCTION_TARGETS.payload,
                    cycleTimeActual: 0,
                    cycleTimeTarget: exports.PRODUCTION_TARGETS.cycleTime,
                    fuelRatioActual: 0,
                    fuelRatioTarget: exports.PRODUCTION_TARGETS.fuelRatio,
                    unitRunningActual: 0,
                    unitRunningTarget: exports.PRODUCTION_TARGETS.unitRunning,
                    tdpActual: 0,
                    tdpTarget: exports.PRODUCTION_TARGETS.tdp,
                    productionActual: 0,
                });
            }
        }
        // Generate all 53 weeks (W01 - W53) matching Sheet 'Grafik KPI 2026'
        const allWeeksKpis = [];
        for (let i = 1; i <= 53; i++) {
            const wStr = `W${String(i).padStart(2, "0")}`;
            const found = weeklyKpis.find((w) => w.weekNumber === wStr);
            if (found) {
                allWeeksKpis.push(found);
            }
            else {
                allWeeksKpis.push({
                    weekNumber: wStr,
                    daysCount: 0,
                    startDate: "",
                    endDate: "",
                    paActual: 0,
                    paTarget: exports.PRODUCTION_TARGETS.pa,
                    uaActual: 0,
                    uaTarget: exports.PRODUCTION_TARGETS.ua,
                    payloadActual: 0,
                    payloadTarget: exports.PRODUCTION_TARGETS.payload,
                    cycleTimeActual: 0,
                    cycleTimeTarget: exports.PRODUCTION_TARGETS.cycleTime,
                    fuelRatioActual: 0,
                    fuelRatioTarget: exports.PRODUCTION_TARGETS.fuelRatio,
                    unitRunningActual: 0,
                    unitRunningTarget: exports.PRODUCTION_TARGETS.unitRunning,
                    tdpActual: 0,
                    tdpTarget: exports.PRODUCTION_TARGETS.tdp,
                    productionActual: 0,
                });
            }
        }
        // Monthly breakdown & targets (Aug, Sep, Oct as in Excel)
        const monthlyTargets = [
            {
                monthKey: "08",
                monthLabel: "Aug",
                name: "Agustus 2026",
                target: 32000,
                actual: Number(records
                    .filter((r) => r.date.startsWith("2026-08") || r.date.startsWith("2026-07-31"))
                    .reduce((acc, r) => acc + r.production, 0)
                    .toFixed(2)),
            },
            {
                monthKey: "09",
                monthLabel: "Sep",
                name: "September 2026",
                target: 398000,
                actual: Number(records
                    .filter((r) => r.date.startsWith("2026-09"))
                    .reduce((acc, r) => acc + r.production, 0)
                    .toFixed(2)),
            },
            {
                monthKey: "10",
                monthLabel: "Oct",
                name: "Oktober 2026",
                target: 671000,
                actual: Number(records
                    .filter((r) => r.date.startsWith("2026-10"))
                    .reduce((acc, r) => acc + r.production, 0)
                    .toFixed(2)),
            },
        ];
        const targetDailyProd = exports.PRODUCTION_TARGETS.dailyProductionQ4;
        res.json({
            success: true,
            data: {
                totalDays,
                totalProduction: Number(totalProduction.toFixed(2)),
                avgProductionDaily: Number(avgProductionDaily.toFixed(2)),
                avgPa: Number(avgPa.toFixed(4)),
                avgUa: Number(avgUa.toFixed(4)),
                avgPayload: Number(avgPayload.toFixed(2)),
                avgCycleTime: Number(avgCycleTime.toFixed(2)),
                avgFuelRatio: Number(avgFuelRatio.toFixed(3)),
                avgUnitRunning: Number(avgUnitRunning.toFixed(1)),
                avgTdp: Number(avgTdp.toFixed(2)),
                targets: exports.PRODUCTION_TARGETS,
                achievement: {
                    paPercent: Number(((avgPa / exports.PRODUCTION_TARGETS.pa) * 100).toFixed(1)),
                    uaPercent: Number(((avgUa / exports.PRODUCTION_TARGETS.ua) * 100).toFixed(1)),
                    payloadPercent: Number(((avgPayload / exports.PRODUCTION_TARGETS.payload) * 100).toFixed(1)),
                    // Cycle Time lower is better
                    cycleTimePercent: Number(((exports.PRODUCTION_TARGETS.cycleTime / avgCycleTime) * 100).toFixed(1)),
                    // Fuel Ratio lower is better
                    fuelRatioPercent: Number(((exports.PRODUCTION_TARGETS.fuelRatio / avgFuelRatio) * 100).toFixed(1)),
                    tdpPercent: Number(((avgTdp / exports.PRODUCTION_TARGETS.tdp) * 100).toFixed(1)),
                    productionPercent: Number(((avgProductionDaily / targetDailyProd) * 100).toFixed(1)),
                },
                weeklyKpis,
                allWeeksKpis,
                monthlyTargets,
            },
        });
    }
    catch (error) {
        console.error("Error computing production stats:", error);
        res.status(500).json({
            success: false,
            message: "Gagal menghitung statistik produksi",
            error: error.message,
        });
    }
};
exports.getProductionStats = getProductionStats;
/**
 * POST /api/production/daily
 * Create or upsert a daily production record
 */
const createDailyProduction = async (req, res) => {
    try {
        const { date, jobSite = "MuaraPahu", weekNumber, pa, ua, payload, cycleTime, fuelRatio, unitRunning, tdp, production, notes, } = req.body;
        if (!date) {
            return res.status(400).json({
                success: false,
                message: "Tanggal wajib diisi!",
            });
        }
        const resolvedWeekNumber = weekNumber && weekNumber.trim() !== ""
            ? weekNumber.trim().toUpperCase()
            : calculateWeekNumber(String(date));
        const parsedPa = normalizeRate(pa, exports.PRODUCTION_TARGETS.pa);
        const parsedUa = normalizeRate(ua, exports.PRODUCTION_TARGETS.ua);
        const parsedPayload = parseNum(payload, exports.PRODUCTION_TARGETS.payload);
        const parsedCycleTime = parseNum(cycleTime, exports.PRODUCTION_TARGETS.cycleTime);
        const parsedFuelRatio = parseNum(fuelRatio, exports.PRODUCTION_TARGETS.fuelRatio);
        const parsedUnitRunning = Math.round(parseNum(unitRunning, exports.PRODUCTION_TARGETS.unitRunning));
        const parsedTdp = parseNum(tdp, exports.PRODUCTION_TARGETS.tdp);
        // Auto-compute production if not explicitly provided: unitRunning * payload * tdp
        let parsedProduction = parseNum(production, 0);
        if (parsedProduction <= 0) {
            parsedProduction = Number((parsedUnitRunning * parsedPayload * parsedTdp).toFixed(2));
        }
        const siteEnum = jobSite || client_1.JobSite.MuaraPahu;
        const record = await prisma_1.prisma.dailyProduction.upsert({
            where: {
                jobSite_date: {
                    jobSite: siteEnum,
                    date: String(date),
                },
            },
            create: {
                jobSite: siteEnum,
                date: String(date),
                weekNumber: resolvedWeekNumber,
                pa: parsedPa,
                ua: parsedUa,
                payload: parsedPayload,
                cycleTime: parsedCycleTime,
                fuelRatio: parsedFuelRatio,
                unitRunning: parsedUnitRunning,
                tdp: parsedTdp,
                production: parsedProduction,
                notes: notes ? String(notes).trim() : null,
            },
            update: {
                weekNumber: resolvedWeekNumber,
                pa: parsedPa,
                ua: parsedUa,
                payload: parsedPayload,
                cycleTime: parsedCycleTime,
                fuelRatio: parsedFuelRatio,
                unitRunning: parsedUnitRunning,
                tdp: parsedTdp,
                production: parsedProduction,
                notes: notes ? String(notes).trim() : null,
            },
        });
        res.status(201).json({
            success: true,
            message: `Data produksi tanggal ${record.date} (${record.weekNumber}) berhasil disimpan!`,
            data: record,
        });
    }
    catch (error) {
        console.error("Error creating daily production:", error);
        res.status(500).json({
            success: false,
            message: "Gagal menyimpan data produksi harian",
            error: error.message,
        });
    }
};
exports.createDailyProduction = createDailyProduction;
/**
 * PUT /api/production/daily/:id
 * Update an existing daily production record
 */
const updateDailyProduction = async (req, res) => {
    try {
        const id = String(req.params.id);
        const { date, jobSite, weekNumber, pa, ua, payload, cycleTime, fuelRatio, unitRunning, tdp, production, notes, } = req.body;
        const existing = await prisma_1.prisma.dailyProduction.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Data produksi tidak ditemukan!",
            });
        }
        const resolvedDate = date ? String(date) : existing.date;
        const resolvedWeekNumber = weekNumber !== undefined
            ? String(weekNumber).toUpperCase()
            : (date ? calculateWeekNumber(resolvedDate) : existing.weekNumber);
        const parsedPa = pa !== undefined ? normalizeRate(pa, existing.pa) : existing.pa;
        const parsedUa = ua !== undefined ? normalizeRate(ua, existing.ua) : existing.ua;
        const parsedPayload = payload !== undefined ? parseNum(payload, existing.payload) : existing.payload;
        const parsedCycleTime = cycleTime !== undefined ? parseNum(cycleTime, existing.cycleTime) : existing.cycleTime;
        const parsedFuelRatio = fuelRatio !== undefined ? parseNum(fuelRatio, existing.fuelRatio) : existing.fuelRatio;
        const parsedUnitRunning = unitRunning !== undefined ? Math.round(parseNum(unitRunning, existing.unitRunning)) : existing.unitRunning;
        const parsedTdp = tdp !== undefined ? parseNum(tdp, existing.tdp) : existing.tdp;
        let parsedProduction = production !== undefined ? parseNum(production, existing.production) : existing.production;
        if (production === undefined && (payload !== undefined || unitRunning !== undefined || tdp !== undefined)) {
            parsedProduction = Number((parsedUnitRunning * parsedPayload * parsedTdp).toFixed(2));
        }
        const updated = await prisma_1.prisma.dailyProduction.update({
            where: { id },
            data: {
                date: resolvedDate,
                ...(jobSite && { jobSite: jobSite }),
                weekNumber: resolvedWeekNumber,
                pa: parsedPa,
                ua: parsedUa,
                payload: parsedPayload,
                cycleTime: parsedCycleTime,
                fuelRatio: parsedFuelRatio,
                unitRunning: parsedUnitRunning,
                tdp: parsedTdp,
                production: parsedProduction,
                ...(notes !== undefined && { notes: notes ? String(notes).trim() : null }),
            },
        });
        res.json({
            success: true,
            message: "Data produksi berhasil diperbarui!",
            data: updated,
        });
    }
    catch (error) {
        console.error("Error updating daily production:", error);
        res.status(500).json({
            success: false,
            message: "Gagal memperbarui data produksi harian",
            error: error.message,
        });
    }
};
exports.updateDailyProduction = updateDailyProduction;
/**
 * DELETE /api/production/daily/:id
 * Delete a daily production record
 */
const deleteDailyProduction = async (req, res) => {
    try {
        const id = String(req.params.id);
        const existing = await prisma_1.prisma.dailyProduction.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Data produksi tidak ditemukan!",
            });
        }
        await prisma_1.prisma.dailyProduction.delete({ where: { id } });
        res.json({
            success: true,
            message: `Data produksi tanggal ${existing.date} berhasil dihapus!`,
        });
    }
    catch (error) {
        console.error("Error deleting daily production:", error);
        res.status(500).json({
            success: false,
            message: "Gagal menghapus data produksi",
            error: error.message,
        });
    }
};
exports.deleteDailyProduction = deleteDailyProduction;
/**
 * POST /api/production/daily/sync-bundled-excel
 * Automatically parse and sync all records from "KPI . Anual 2026 Wajib Input Daily + UA.xlsx"
 */
const syncBundledExcel = async (req, res) => {
    try {
        const filePath = path_1.default.join(__dirname, "../excel/KPI . Anual 2026 Wajib Input Daily + UA.xlsx");
        if (!fs_1.default.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: `File Excel master tidak ditemukan di: ${filePath}`,
            });
        }
        const wb = xlsx.readFile(filePath, { cellDates: true });
        const ws = wb.Sheets["Input Data Daily"];
        if (!ws) {
            return res.status(400).json({
                success: false,
                message: "Sheet 'Input Data Daily' tidak ditemukan di file Excel master!",
            });
        }
        const rawData = xlsx.utils.sheet_to_json(ws, { range: 3 });
        const imported = [];
        for (const r of rawData) {
            if (r["PA"] !== undefined || r["Produksi"] !== undefined || r["Cycle Time"] !== undefined) {
                let dateStr = "";
                if (r["Tanggal"] instanceof Date) {
                    dateStr = r["Tanggal"].toISOString().slice(0, 10);
                }
                else if (typeof r["Tanggal"] === "number") {
                    // Convert Excel serial date to YYYY-MM-DD
                    const jsDate = new Date(Math.round((r["Tanggal"] - 25569) * 86400 * 1000));
                    dateStr = jsDate.toISOString().slice(0, 10);
                }
                else if (typeof r["Tanggal"] === "string") {
                    dateStr = r["Tanggal"].trim();
                }
                if (!dateStr || dateStr.length < 8)
                    continue;
                const week = r["Kelompok Minggu"] || calculateWeekNumber(dateStr);
                const paVal = normalizeRate(r["PA"], exports.PRODUCTION_TARGETS.pa);
                const uaVal = normalizeRate(r["UA"], exports.PRODUCTION_TARGETS.ua);
                const payloadVal = parseNum(r["Payload"], exports.PRODUCTION_TARGETS.payload);
                const ctVal = parseNum(r["Cycle Time"], exports.PRODUCTION_TARGETS.cycleTime);
                const frVal = parseNum(r["Fuel Ratio"], exports.PRODUCTION_TARGETS.fuelRatio);
                const unitVal = Math.round(parseNum(r["Unit Running"], 0));
                const tdpVal = parseNum(r["TDP"], 0);
                let prodVal = parseNum(r["Produksi"], 0);
                if (prodVal <= 0 && unitVal > 0 && payloadVal > 0) {
                    prodVal = Number((unitVal * payloadVal * (tdpVal || 1)).toFixed(2));
                }
                const note = r["Keterangan"] ? String(r["Keterangan"]).trim() : null;
                const record = await prisma_1.prisma.dailyProduction.upsert({
                    where: {
                        jobSite_date: {
                            jobSite: client_1.JobSite.MuaraPahu,
                            date: dateStr,
                        },
                    },
                    create: {
                        jobSite: client_1.JobSite.MuaraPahu,
                        date: dateStr,
                        weekNumber: week,
                        pa: paVal,
                        ua: uaVal,
                        payload: payloadVal,
                        cycleTime: ctVal,
                        fuelRatio: frVal,
                        unitRunning: unitVal,
                        tdp: tdpVal,
                        production: prodVal,
                        notes: note,
                    },
                    update: {
                        weekNumber: week,
                        pa: paVal,
                        ua: uaVal,
                        payload: payloadVal,
                        cycleTime: ctVal,
                        fuelRatio: frVal,
                        unitRunning: unitVal,
                        tdp: tdpVal,
                        production: prodVal,
                        notes: note,
                    },
                });
                imported.push(record);
            }
        }
        res.json({
            success: true,
            message: `Berhasil menyinkronkan ${imported.length} data produksi dari Excel master KPI Anual 2026!`,
            count: imported.length,
            sample: imported.slice(0, 3),
        });
    }
    catch (error) {
        console.error("Error syncing bundled excel:", error);
        res.status(500).json({
            success: false,
            message: "Gagal menyinkronkan data dari file Excel master",
            error: error.message,
        });
    }
};
exports.syncBundledExcel = syncBundledExcel;
/**
 * POST /api/production/daily/upload-excel
 * Upload user-provided excel file and sync records
 */
const uploadExcelProduction = async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({
                success: false,
                message: "Tidak ada file Excel yang diunggah!",
            });
        }
        const jobSite = req.body.jobSite || client_1.JobSite.MuaraPahu;
        const wb = xlsx.read(file.buffer, { type: "buffer", cellDates: true });
        // Look for sheet named "Input Data Daily" or use first sheet
        const targetSheetName = wb.SheetNames.find((s) => s.toLowerCase().includes("daily")) || wb.SheetNames[0];
        const ws = wb.Sheets[targetSheetName];
        if (!ws) {
            return res.status(400).json({
                success: false,
                message: "Sheet data harian tidak ditemukan di file Excel!",
            });
        }
        const rawData = xlsx.utils.sheet_to_json(ws, { range: 3 });
        const imported = [];
        for (const r of rawData) {
            if (r["PA"] !== undefined || r["Produksi"] !== undefined || r["Cycle Time"] !== undefined) {
                let dateStr = "";
                if (r["Tanggal"] instanceof Date) {
                    dateStr = r["Tanggal"].toISOString().slice(0, 10);
                }
                else if (typeof r["Tanggal"] === "number") {
                    const jsDate = new Date(Math.round((r["Tanggal"] - 25569) * 86400 * 1000));
                    dateStr = jsDate.toISOString().slice(0, 10);
                }
                else if (typeof r["Tanggal"] === "string") {
                    dateStr = r["Tanggal"].trim();
                }
                if (!dateStr || dateStr.length < 8)
                    continue;
                const week = r["Kelompok Minggu"] || calculateWeekNumber(dateStr);
                const paVal = normalizeRate(r["PA"], exports.PRODUCTION_TARGETS.pa);
                const uaVal = normalizeRate(r["UA"], exports.PRODUCTION_TARGETS.ua);
                const payloadVal = parseNum(r["Payload"], exports.PRODUCTION_TARGETS.payload);
                const ctVal = parseNum(r["Cycle Time"], exports.PRODUCTION_TARGETS.cycleTime);
                const frVal = parseNum(r["Fuel Ratio"], exports.PRODUCTION_TARGETS.fuelRatio);
                const unitVal = Math.round(parseNum(r["Unit Running"], 0));
                const tdpVal = parseNum(r["TDP"], 0);
                let prodVal = parseNum(r["Produksi"], 0);
                if (prodVal <= 0 && unitVal > 0 && payloadVal > 0) {
                    prodVal = Number((unitVal * payloadVal * (tdpVal || 1)).toFixed(2));
                }
                const note = r["Keterangan"] ? String(r["Keterangan"]).trim() : null;
                const record = await prisma_1.prisma.dailyProduction.upsert({
                    where: {
                        jobSite_date: {
                            jobSite,
                            date: dateStr,
                        },
                    },
                    create: {
                        jobSite,
                        date: dateStr,
                        weekNumber: week,
                        pa: paVal,
                        ua: uaVal,
                        payload: payloadVal,
                        cycleTime: ctVal,
                        fuelRatio: frVal,
                        unitRunning: unitVal,
                        tdp: tdpVal,
                        production: prodVal,
                        notes: note,
                    },
                    update: {
                        weekNumber: week,
                        pa: paVal,
                        ua: uaVal,
                        payload: payloadVal,
                        cycleTime: ctVal,
                        fuelRatio: frVal,
                        unitRunning: unitVal,
                        tdp: tdpVal,
                        production: prodVal,
                        notes: note,
                    },
                });
                imported.push(record);
            }
        }
        res.json({
            success: true,
            message: `Berhasil mengimpor ${imported.length} data produksi dari file Excel!`,
            count: imported.length,
        });
    }
    catch (error) {
        console.error("Error uploading excel production:", error);
        res.status(500).json({
            success: false,
            message: "Gagal memproses file Excel yang diunggah",
            error: error.message,
        });
    }
};
exports.uploadExcelProduction = uploadExcelProduction;
/**
 * POST /api/production/calculate-ua
 * Interactive UA Calculator endpoint (Formula from sheet 'Kalkulator UA')
 */
const calculateUA = async (req, res) => {
    try {
        const { calendarHours = 24, plannedDelay = 2.3333333333333335, pa = 1.0, targetTrip = 3.0, actualTrip = 3.03, } = req.body;
        const calH = parseNum(calendarHours, 24);
        const delayH = parseNum(plannedDelay, 2.333);
        const parsedPa = normalizeRate(pa, 1.0);
        const tgtTrip = parseNum(targetTrip, 3.0);
        const actTrip = parseNum(actualTrip, 3.0);
        const effectiveHours = Math.max(0, calH - delayH);
        const uaPotential = calH > 0 ? (calH - delayH) / calH : 0;
        const tripAchievement = tgtTrip > 0 ? actTrip / tgtTrip : 0;
        const equivalentWorkingHours = effectiveHours * tripAchievement;
        const lostTimeOperational = effectiveHours - equivalentWorkingHours;
        const uaActual = Math.min(1.0, parsedPa * uaPotential * tripAchievement);
        const diffToPotential = uaPotential - uaActual;
        res.json({
            success: true,
            data: {
                calendarHours: calH,
                plannedDelay: Number(delayH.toFixed(2)),
                effectiveHours: Number(effectiveHours.toFixed(2)),
                pa: Number(parsedPa.toFixed(4)),
                paPercent: Number((parsedPa * 100).toFixed(1)),
                targetTrip: tgtTrip,
                actualTrip: actTrip,
                uaPotential: Number(uaPotential.toFixed(4)),
                uaPotentialPercent: Number((uaPotential * 100).toFixed(2)),
                tripAchievement: Number(tripAchievement.toFixed(4)),
                tripAchievementPercent: Number((tripAchievement * 100).toFixed(1)),
                equivalentWorkingHours: Number(equivalentWorkingHours.toFixed(2)),
                lostTimeOperational: Number(lostTimeOperational.toFixed(2)),
                uaActual: Number(uaActual.toFixed(4)),
                uaActualPercent: Number((uaActual * 100).toFixed(2)),
                diffToPotential: Number(diffToPotential.toFixed(4)),
                targetUa: exports.PRODUCTION_TARGETS.ua,
                isAchieved: uaActual >= exports.PRODUCTION_TARGETS.ua,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Gagal menghitung Kalkulator UA",
            error: error.message,
        });
    }
};
exports.calculateUA = calculateUA;
