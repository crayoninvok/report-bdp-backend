"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyBreakdownController = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("../generated/prisma/client");
function calculateDurationHours(startTime, finishTime) {
    if (!startTime || !finishTime)
        return 0;
    const sParts = startTime.trim().split(":");
    const fParts = finishTime.trim().split(":");
    if (sParts.length < 2 || fParts.length < 2)
        return 0;
    const sHour = parseInt(sParts[0], 10);
    const sMin = parseInt(sParts[1], 10);
    const fHour = parseInt(fParts[0], 10);
    const fMin = parseInt(fParts[1], 10);
    if (isNaN(sHour) || isNaN(sMin) || isNaN(fHour) || isNaN(fMin))
        return 0;
    let totalMinutes = (fHour * 60 + fMin) - (sHour * 60 + sMin);
    if (totalMinutes < 0) {
        // Crosses midnight
        totalMinutes += 24 * 60;
    }
    return Math.round((totalMinutes / 60) * 100) / 100;
}
exports.dailyBreakdownController = {
    /**
     * GET /api/plant/daily-breakdown
     * Fetches daily breakdown report list with optional filtering and summary metrics.
     */
    getDailyBreakdownList: async (req, res) => {
        try {
            const { site, date, startDate, endDate, status, category, search } = req.query;
            const where = {};
            if (site && site !== "all") {
                where.jobSite = site;
            }
            if (date) {
                where.date = String(date);
            }
            else if (startDate || endDate) {
                where.date = {};
                if (startDate)
                    where.date.gte = String(startDate);
                if (endDate)
                    where.date.lte = String(endDate);
            }
            if (status && status !== "All") {
                where.status = String(status);
            }
            if (category && category !== "All") {
                where.category = String(category);
            }
            if (search && String(search).trim() !== "") {
                const q = String(search).trim();
                where.OR = [
                    { unitCode: { contains: q, mode: "insensitive" } },
                    { unitType: { contains: q, mode: "insensitive" } },
                    { woNumber: { contains: q, mode: "insensitive" } },
                    { breakdownDescription: { contains: q, mode: "insensitive" } },
                    { detailActivity: { contains: q, mode: "insensitive" } },
                    { component: { contains: q, mode: "insensitive" } },
                    { mechanic: { contains: q, mode: "insensitive" } },
                    { supervisor: { contains: q, mode: "insensitive" } },
                    { location: { contains: q, mode: "insensitive" } },
                ];
            }
            const list = await prisma_1.prisma.dailyBreakdownReport.findMany({
                where,
                orderBy: [
                    { date: "desc" },
                    { startTime: "desc" },
                    { createdAt: "desc" },
                ],
                include: {
                    unit: {
                        select: {
                            unitCode: true,
                            brand: true,
                            model: true,
                            category: true,
                            status: true,
                            currentHm: true,
                            currentKm: true,
                        },
                    },
                },
            });
            // Compute summary
            let openCount = 0;
            let closeCount = 0;
            let totalDurationHours = 0;
            const categoryCounts = {
                SCM: 0,
                USM: 0,
                TSM: 0,
                TUM: 0,
                ICM: 0,
            };
            for (const item of list) {
                if (item.status === "Close")
                    closeCount++;
                else
                    openCount++;
                totalDurationHours += item.durationHours || 0;
                if (categoryCounts[item.category] !== undefined) {
                    categoryCounts[item.category]++;
                }
            }
            return res.json({
                success: true,
                data: list,
                summary: {
                    total: list.length,
                    open: openCount,
                    close: closeCount,
                    totalDurationHours: Math.round(totalDurationHours * 100) / 100,
                    categories: categoryCounts,
                },
            });
        }
        catch (err) {
            console.error("Error getDailyBreakdownList:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Gagal memuat data Daily Breakdown Report",
            });
        }
    },
    /**
     * POST /api/plant/daily-breakdown
     * Creates a new Daily Breakdown record.
     */
    createDailyBreakdown: async (req, res) => {
        try {
            const { date, jobSite = "MuaraPahu", unitCode, unitType, woNumber, hm, km, category = "SCM", startTime, finishTime, durationHours, breakdownDescription, detailActivity, component, mechanic, supervisor, location, status = "Open", notes, } = req.body;
            if (!date) {
                return res.status(400).json({ success: false, message: "Tanggal breakdown wajib diisi." });
            }
            if (!unitCode) {
                return res.status(400).json({ success: false, message: "Vehicle Number / Kode Unit wajib diisi." });
            }
            if (!breakdownDescription) {
                return res.status(400).json({ success: false, message: "Breakdown Description wajib diisi." });
            }
            // Check MasterUnit for auto-filling type, hm, km if empty
            const masterUnit = await prisma_1.prisma.masterUnit.findUnique({
                where: { unitCode: String(unitCode).trim() },
            });
            const resolvedType = unitType && String(unitType).trim() !== ""
                ? String(unitType).trim()
                : masterUnit?.model || null;
            const resolvedHm = hm !== undefined && hm !== null && hm !== ""
                ? Number(hm)
                : masterUnit?.currentHm || null;
            const resolvedKm = km !== undefined && km !== null && km !== ""
                ? Number(km)
                : masterUnit?.currentKm || null;
            let resolvedDuration = durationHours !== undefined && durationHours !== null && durationHours !== ""
                ? Number(durationHours)
                : 0;
            if ((resolvedDuration === 0 || isNaN(resolvedDuration)) && startTime && finishTime) {
                resolvedDuration = calculateDurationHours(startTime, finishTime);
            }
            const created = await prisma_1.prisma.dailyBreakdownReport.create({
                data: {
                    date: String(date).trim(),
                    jobSite: jobSite || client_1.JobSite.MuaraPahu,
                    unitCode: String(unitCode).trim(),
                    unitType: resolvedType,
                    woNumber: woNumber ? String(woNumber).trim() : null,
                    hm: resolvedHm != null && !isNaN(resolvedHm) ? resolvedHm : null,
                    km: resolvedKm != null && !isNaN(resolvedKm) ? resolvedKm : null,
                    category: String(category).trim().toUpperCase() || "SCM",
                    startTime: startTime ? String(startTime).trim() : null,
                    finishTime: finishTime ? String(finishTime).trim() : null,
                    durationHours: Math.round(resolvedDuration * 100) / 100,
                    breakdownDescription: String(breakdownDescription).trim(),
                    detailActivity: detailActivity ? String(detailActivity).trim() : null,
                    component: component ? String(component).trim() : null,
                    mechanic: mechanic ? String(mechanic).trim() : null,
                    supervisor: supervisor ? String(supervisor).trim() : null,
                    location: location ? String(location).trim() : null,
                    status: status ? String(status).trim() : "Open",
                    notes: notes ? String(notes).trim() : null,
                },
                include: {
                    unit: true,
                },
            });
            return res.status(201).json({
                success: true,
                message: `Breakdown unit ${created.unitCode} berhasil dicatat.`,
                data: created,
            });
        }
        catch (err) {
            console.error("Error createDailyBreakdown:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Gagal mencatat data Daily Breakdown Report",
            });
        }
    },
    /**
     * PUT /api/plant/daily-breakdown/:id
     * Updates an existing Daily Breakdown record.
     */
    updateDailyBreakdown: async (req, res) => {
        try {
            const { id } = req.params;
            const { date, jobSite, unitCode, unitType, woNumber, hm, km, category, startTime, finishTime, durationHours, breakdownDescription, detailActivity, component, mechanic, supervisor, location, status, notes, } = req.body;
            const existing = await prisma_1.prisma.dailyBreakdownReport.findUnique({
                where: { id: String(id) },
            });
            if (!existing) {
                return res.status(404).json({ success: false, message: "Data breakdown tidak ditemukan." });
            }
            const updateData = {};
            if (date !== undefined)
                updateData.date = String(date).trim();
            if (jobSite !== undefined)
                updateData.jobSite = jobSite;
            if (unitCode !== undefined)
                updateData.unitCode = String(unitCode).trim();
            if (unitType !== undefined)
                updateData.unitType = unitType ? String(unitType).trim() : null;
            if (woNumber !== undefined)
                updateData.woNumber = woNumber ? String(woNumber).trim() : null;
            if (hm !== undefined)
                updateData.hm = hm !== null && hm !== "" ? Number(hm) : null;
            if (km !== undefined)
                updateData.km = km !== null && km !== "" ? Number(km) : null;
            if (category !== undefined)
                updateData.category = String(category).trim().toUpperCase();
            if (startTime !== undefined)
                updateData.startTime = startTime ? String(startTime).trim() : null;
            if (finishTime !== undefined)
                updateData.finishTime = finishTime ? String(finishTime).trim() : null;
            if (breakdownDescription !== undefined)
                updateData.breakdownDescription = String(breakdownDescription).trim();
            if (detailActivity !== undefined)
                updateData.detailActivity = detailActivity ? String(detailActivity).trim() : null;
            if (component !== undefined)
                updateData.component = component ? String(component).trim() : null;
            if (mechanic !== undefined)
                updateData.mechanic = mechanic ? String(mechanic).trim() : null;
            if (supervisor !== undefined)
                updateData.supervisor = supervisor ? String(supervisor).trim() : null;
            if (location !== undefined)
                updateData.location = location ? String(location).trim() : null;
            if (status !== undefined)
                updateData.status = String(status).trim();
            if (notes !== undefined)
                updateData.notes = notes ? String(notes).trim() : null;
            // Handle duration
            if (durationHours !== undefined && durationHours !== null && durationHours !== "") {
                updateData.durationHours = Number(durationHours);
            }
            else {
                const calcStart = startTime !== undefined ? startTime : existing.startTime;
                const calcFinish = finishTime !== undefined ? finishTime : existing.finishTime;
                if (calcStart && calcFinish) {
                    updateData.durationHours = calculateDurationHours(calcStart, calcFinish);
                }
            }
            const updated = await prisma_1.prisma.dailyBreakdownReport.update({
                where: { id: String(id) },
                data: updateData,
                include: {
                    unit: true,
                },
            });
            return res.json({
                success: true,
                message: `Breakdown unit ${updated.unitCode} berhasil diperbarui.`,
                data: updated,
            });
        }
        catch (err) {
            console.error("Error updateDailyBreakdown:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Gagal memperbarui data Daily Breakdown Report",
            });
        }
    },
    /**
     * DELETE /api/plant/daily-breakdown/:id
     * Deletes a Daily Breakdown record.
     */
    deleteDailyBreakdown: async (req, res) => {
        try {
            const { id } = req.params;
            const existing = await prisma_1.prisma.dailyBreakdownReport.findUnique({
                where: { id: String(id) },
            });
            if (!existing) {
                return res.status(404).json({ success: false, message: "Data breakdown tidak ditemukan." });
            }
            await prisma_1.prisma.dailyBreakdownReport.delete({
                where: { id: String(id) },
            });
            return res.json({
                success: true,
                message: `Data breakdown unit ${existing.unitCode} berhasil dihapus.`,
            });
        }
        catch (err) {
            console.error("Error deleteDailyBreakdown:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Gagal menghapus data Daily Breakdown Report",
            });
        }
    },
};
