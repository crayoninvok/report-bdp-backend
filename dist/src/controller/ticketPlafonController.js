"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResetCycleDays = getResetCycleDays;
exports.calculateResetDateByPosition = calculateResetDateByPosition;
exports.getTicketPlafonList = getTicketPlafonList;
exports.recordTicketUsage = recordTicketUsage;
exports.getTicketHistory = getTicketHistory;
exports.updatePlafonConfig = updatePlafonConfig;
exports.resetPlafonManual = resetPlafonManual;
exports.getTicketAnalytics = getTicketAnalytics;
exports.recalculateEmployeePlafon = recalculateEmployeePlafon;
exports.updateTicketUsageHistory = updateTicketUsageHistory;
exports.deleteTicketUsageHistory = deleteTicketUsageHistory;
exports.refundTicketUsageHistory = refundTicketUsageHistory;
exports.cancelRefundTicketUsageHistory = cancelRefundTicketUsageHistory;
const prisma_1 = require("../lib/prisma");
const DEFAULT_PLAFON_AMOUNT = 5500000; // Rp 5.500.000,00 (5,5 Juta)
/**
 * Helper to determine reset cycle in days based on employee job position:
 * - 48 Hari: Project Manager, Deputy Pjo
 * - 90 Hari: Admin, Driver Double Trailer, Mechanic, Electrician, Welder
 * - 65 Hari: Posisi lainnya (Default)
 */
function getResetCycleDays(jobPosition) {
    if (!jobPosition)
        return 65;
    const pos = jobPosition.toLowerCase().trim();
    // 48 Hari: Project Manager, Deputy Pjo
    if (pos.includes("project manager") || pos.includes("deputy pjo")) {
        return 48;
    }
    // 90 Hari: Admin, Driver Double Trailer, Mechanic, Electrician, Welder
    if (pos.includes("driver double trailer") ||
        pos.includes("mechanic") ||
        pos.includes("electrician") ||
        pos.includes("welder") ||
        pos.includes("admin")) {
        return 90;
    }
    // 65 Hari: Posisi lainnya
    return 65;
}
/**
 * Helper to calculate auto-reset date from departure date based on job position
 */
function calculateResetDateByPosition(departureDate, jobPosition) {
    const days = getResetCycleDays(jobPosition);
    const resetDate = new Date(departureDate);
    resetDate.setDate(resetDate.getDate() + days);
    return resetDate;
}
/**
 * GET /api/ticket-plafon
 * List Non-Lokal manpower with ticket plafon info, separated by site (Senyiur / Muara Pahu / ALL).
 * Automatically checks and applies 65-day auto-reset when now >= nextResetDate.
 */
async function getTicketPlafonList(req, res) {
    try {
        const { site, search, department } = req.query;
        const now = new Date();
        // 1. First, perform automatic reset for records whose nextResetDate <= now and usedAmount > 0
        const expiredPlafons = await prisma_1.prisma.manpowerTicketPlafon.findMany({
            where: {
                nextResetDate: {
                    lte: now,
                },
                usedAmount: {
                    gt: 0,
                },
            },
        });
        if (expiredPlafons.length > 0) {
            await prisma_1.prisma.$transaction(expiredPlafons.map((p) => prisma_1.prisma.manpowerTicketPlafon.update({
                where: { id: p.id },
                data: {
                    usedAmount: 0,
                    notes: p.notes
                        ? `${p.notes} (Auto-reset 65 hari ke Rp ${(p.plafonAmount || DEFAULT_PLAFON_AMOUNT).toLocaleString("id-ID")} pada ${now.toISOString().split("T")[0]})`
                        : `Auto-reset 65 hari ke Rp ${(p.plafonAmount || DEFAULT_PLAFON_AMOUNT).toLocaleString("id-ID")} pada ${now.toISOString().split("T")[0]}`,
                },
            })));
        }
        // 2. Build where filter for MasterManpower: statusKeaktifan = Exist, pointOfHire = Non Lokal
        const whereCondition = {
            statusKeaktifan: {
                equals: "Exist",
                mode: "insensitive",
            },
            pointOfHire: {
                equals: "Non Lokal",
                mode: "insensitive",
            },
        };
        if (site && site !== "ALL") {
            const siteStr = String(site).trim().toLowerCase();
            if (siteStr.includes("senyiur")) {
                whereCondition.branchName = {
                    contains: "Senyiur",
                    mode: "insensitive",
                };
            }
            else if (siteStr.includes("muara") || siteStr.includes("pahu")) {
                whereCondition.branchName = {
                    contains: "Pahu",
                    mode: "insensitive",
                };
            }
            else if (siteStr.includes("jakarta") || siteStr.includes("ho") || siteStr.includes("head")) {
                whereCondition.branchName = {
                    contains: "Jakarta",
                    mode: "insensitive",
                };
            }
        }
        if (department && department !== "ALL") {
            whereCondition.organization = {
                equals: String(department),
                mode: "insensitive",
            };
        }
        if (search) {
            const searchStr = String(search).trim();
            whereCondition.OR = [
                { employeeId: { contains: searchStr, mode: "insensitive" } },
                { fullName: { contains: searchStr, mode: "insensitive" } },
                { jobPosition: { contains: searchStr, mode: "insensitive" } },
            ];
        }
        // 3. Query all eligible MasterManpower
        const manpowerList = await prisma_1.prisma.masterManpower.findMany({
            where: whereCondition,
            orderBy: [
                { branchName: "asc" },
                { fullName: "asc" },
            ],
            select: {
                id: true,
                employeeId: true,
                fullName: true,
                branchName: true,
                jobPosition: true,
                organization: true,
                statusEmployee: true,
                pointOfHire: true,
                statusKeaktifan: true,
            },
        });
        // 4. Fetch plafon records for these employees
        const employeeIds = manpowerList.map((m) => m.employeeId);
        const plafonRecords = await prisma_1.prisma.manpowerTicketPlafon.findMany({
            where: {
                employeeId: { in: employeeIds },
            },
        });
        const plafonMap = new Map();
        for (const record of plafonRecords) {
            plafonMap.set(record.employeeId, record);
        }
        // 5. Combine data and calculate summary KPIs
        let totalPlafonAllocated = 0;
        let totalPlafonUsed = 0;
        let totalPlafonRemaining = 0;
        let countDueForReset = 0;
        let countActiveTicketUsage = 0;
        const data = manpowerList.map((mp) => {
            const plafon = plafonMap.get(mp.employeeId);
            const plafonAmount = plafon?.plafonAmount ?? DEFAULT_PLAFON_AMOUNT;
            const usedAmount = plafon?.usedAmount ?? 0;
            const remainingAmount = Math.max(0, plafonAmount - usedAmount);
            const lastDepartureDate = plafon?.lastDepartureDate ?? null;
            const nextResetDate = plafon?.nextResetDate ?? null;
            const ticketCount = plafon?.ticketCount ?? 0;
            const notes = plafon?.notes ?? null;
            const isResetEligible = nextResetDate ? new Date() >= nextResetDate : false;
            const daysUntilReset = nextResetDate
                ? Math.ceil((new Date(nextResetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                : null;
            totalPlafonAllocated += plafonAmount;
            totalPlafonUsed += usedAmount;
            totalPlafonRemaining += remainingAmount;
            if (isResetEligible && usedAmount > 0) {
                countDueForReset += 1;
            }
            if (usedAmount > 0) {
                countActiveTicketUsage += 1;
            }
            // Normalize site name for UI grouping
            const bName = mp.branchName?.toLowerCase() || "";
            const normalizedSite = bName.includes("senyiur")
                ? "Senyiur"
                : bName.includes("pahu")
                    ? "Muara Pahu"
                    : bName.includes("jakarta") || bName.includes("ho")
                        ? "Head Office Jakarta"
                        : mp.branchName || "Other";
            const resetCycleDays = getResetCycleDays(mp.jobPosition);
            return {
                id: mp.id,
                employeeId: mp.employeeId,
                fullName: mp.fullName,
                branchName: mp.branchName,
                site: normalizedSite,
                jobPosition: mp.jobPosition,
                organization: mp.organization,
                jobStatus: mp.statusEmployee,
                statusEmployee: mp.statusEmployee,
                pointOfHire: mp.pointOfHire,
                plafonAmount,
                usedAmount,
                remainingAmount,
                lastDepartureDate,
                nextResetDate,
                daysUntilReset,
                isResetEligible,
                ticketCount,
                notes,
                resetCycleDays,
                plafonId: plafon?.id ?? null,
            };
        });
        // Also get overall counts per site across all Exist & Non-Lokal
        const allNonLokalCounts = await prisma_1.prisma.masterManpower.groupBy({
            by: ["branchName"],
            where: {
                statusKeaktifan: { equals: "Exist", mode: "insensitive" },
                pointOfHire: { equals: "Non Lokal", mode: "insensitive" },
            },
            _count: {
                _all: true,
            },
        });
        let countSenyiurTotal = 0;
        let countMuaraPahuTotal = 0;
        let countHoJakartaTotal = 0;
        let countOtherTotal = 0;
        for (const c of allNonLokalCounts) {
            const bn = (c.branchName || "").toLowerCase();
            if (bn.includes("senyiur")) {
                countSenyiurTotal += c._count._all;
            }
            else if (bn.includes("pahu")) {
                countMuaraPahuTotal += c._count._all;
            }
            else if (bn.includes("jakarta") || bn.includes("ho")) {
                countHoJakartaTotal += c._count._all;
            }
            else {
                countOtherTotal += c._count._all;
            }
        }
        return res.status(200).json({
            success: true,
            data,
            summary: {
                totalEmployees: data.length,
                totalNonLokalAll: countSenyiurTotal + countMuaraPahuTotal + countHoJakartaTotal + countOtherTotal,
                totalSenyiur: countSenyiurTotal,
                totalMuaraPahu: countMuaraPahuTotal,
                totalHoJakarta: countHoJakartaTotal,
                totalPlafonAllocated,
                totalPlafonUsed,
                totalPlafonRemaining,
                countDueForReset,
                countActiveTicketUsage,
            },
        });
    }
    catch (error) {
        console.error("Error in getTicketPlafonList:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal mengambil data Ticket Plafon: " + error.message,
        });
    }
}
/**
 * POST /api/ticket-plafon/usage
 * Record ticket usage for an employee.
 * Updates usedAmount, sets lastDepartureDate, and sets nextResetDate = departureDate + 2 months.
 */
async function recordTicketUsage(req, res) {
    try {
        const { employeeId, ticketNumber, destination, airline, departureDate, returnDate, ticketCost, notes, } = req.body;
        if (!employeeId || !departureDate || ticketCost === undefined) {
            return res.status(400).json({
                success: false,
                message: "employeeId, departureDate, dan ticketCost wajib diisi.",
            });
        }
        const costNum = Number(ticketCost);
        if (isNaN(costNum) || costNum < 0) {
            return res.status(400).json({
                success: false,
                message: "ticketCost harus berupa angka valid >= 0.",
            });
        }
        const depDate = new Date(departureDate);
        if (isNaN(depDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Format departureDate tidak valid.",
            });
        }
        const retDate = returnDate ? new Date(returnDate) : null;
        const baseResetDate = retDate && !isNaN(retDate.getTime()) && retDate > depDate ? retDate : depDate;
        // Get employee job position to apply role-based reset cycle (48 / 65 / 90 days)
        const employeeInfo = await prisma_1.prisma.masterManpower.findFirst({
            where: { employeeId: { equals: employeeId, mode: "insensitive" } },
            select: { jobPosition: true, fullName: true },
        });
        const resetCycleDays = getResetCycleDays(employeeInfo?.jobPosition);
        const nextResetDate = calculateResetDateByPosition(baseResetDate, employeeInfo?.jobPosition);
        // 1. Create TicketUsageHistory
        const history = await prisma_1.prisma.ticketUsageHistory.create({
            data: {
                employeeId,
                ticketNumber: ticketNumber ? String(ticketNumber).trim() : null,
                destination: destination ? String(destination).trim() : null,
                airline: airline ? String(airline).trim() : null,
                departureDate: depDate,
                returnDate: retDate,
                ticketCost: costNum,
                notes: notes ? String(notes).trim() : null,
                status: "Used",
            },
        });
        // 2. Upsert ManpowerTicketPlafon
        const existingPlafon = await prisma_1.prisma.manpowerTicketPlafon.findUnique({
            where: { employeeId },
        });
        let updatedPlafon;
        if (existingPlafon) {
            updatedPlafon = await prisma_1.prisma.manpowerTicketPlafon.update({
                where: { employeeId },
                data: {
                    usedAmount: existingPlafon.usedAmount + costNum,
                    lastDepartureDate: depDate,
                    nextResetDate: nextResetDate,
                    ticketCount: existingPlafon.ticketCount + 1,
                    updatedAt: new Date(),
                },
            });
        }
        else {
            updatedPlafon = await prisma_1.prisma.manpowerTicketPlafon.create({
                data: {
                    employeeId,
                    plafonAmount: DEFAULT_PLAFON_AMOUNT,
                    usedAmount: costNum,
                    lastDepartureDate: depDate,
                    nextResetDate: nextResetDate,
                    ticketCount: 1,
                    notes: notes ? String(notes).trim() : null,
                },
            });
        }
        return res.status(201).json({
            success: true,
            message: `Penggunaan tiket berhasil dicatat. Plafon (Siklus ${resetCycleDays} hari) akan direset otomatis pada ${nextResetDate.toISOString().split("T")[0]}`,
            data: {
                history,
                plafon: updatedPlafon,
            },
        });
    }
    catch (error) {
        console.error("Error in recordTicketUsage:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal mencatat penggunaan tiket: " + error.message,
        });
    }
}
/**
 * GET /api/ticket-plafon/history/:employeeId
 * Get ticket usage history for an employee
 */
async function getTicketHistory(req, res) {
    try {
        const employeeId = String(req.params.employeeId);
        const history = await prisma_1.prisma.ticketUsageHistory.findMany({
            where: { employeeId },
            orderBy: { departureDate: "desc" },
        });
        const plafon = await prisma_1.prisma.manpowerTicketPlafon.findUnique({
            where: { employeeId },
        });
        return res.status(200).json({
            success: true,
            data: {
                history,
                plafon: plafon || {
                    employeeId,
                    plafonAmount: DEFAULT_PLAFON_AMOUNT,
                    usedAmount: 0,
                    ticketCount: 0,
                },
            },
        });
    }
    catch (error) {
        console.error("Error in getTicketHistory:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal mengambil riwayat tiket: " + error.message,
        });
    }
}
/**
 * PUT /api/ticket-plafon/config/:employeeId
 * Update custom plafon amount or notes for an employee
 */
async function updatePlafonConfig(req, res) {
    try {
        const employeeId = String(req.params.employeeId);
        const { plafonAmount, notes } = req.body;
        const amountNum = Number(plafonAmount);
        if (isNaN(amountNum) || amountNum < 0) {
            return res.status(400).json({
                success: false,
                message: "plafonAmount harus berupa angka valid >= 0.",
            });
        }
        const plafon = await prisma_1.prisma.manpowerTicketPlafon.upsert({
            where: { employeeId },
            update: {
                plafonAmount: amountNum,
                notes: notes !== undefined ? notes : undefined,
            },
            create: {
                employeeId,
                plafonAmount: amountNum,
                usedAmount: 0,
                notes: notes || null,
            },
        });
        return res.status(200).json({
            success: true,
            message: "Plafon berhasil diperbarui.",
            data: plafon,
        });
    }
    catch (error) {
        console.error("Error in updatePlafonConfig:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal memperbarui konfigurasi plafon: " + error.message,
        });
    }
}
/**
 * POST /api/ticket-plafon/reset/:employeeId
 * Manually reset ticket plafon for an employee
 */
async function resetPlafonManual(req, res) {
    try {
        const employeeId = String(req.params.employeeId);
        const plafon = await prisma_1.prisma.manpowerTicketPlafon.update({
            where: { employeeId },
            data: {
                usedAmount: 0,
                notes: `Reset manual oleh admin pada ${new Date().toISOString().split("T")[0]}`,
            },
        });
        return res.status(200).json({
            success: true,
            message: `Plafon untuk NIK ${employeeId} berhasil direset ke Rp ${plafon.plafonAmount.toLocaleString("id-ID")}`,
            data: plafon,
        });
    }
    catch (error) {
        console.error("Error in resetPlafonManual:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal mereset plafon: " + error.message,
        });
    }
}
/**
 * GET /api/ticket-plafon/analytics
 * Get YTD ticket purchase analytics and trends based on manpower (from April 2026 to present).
 * Supports optional site filtering (Senyiur / Muara Pahu / Head Office Jakarta / ALL).
 */
async function getTicketAnalytics(req, res) {
    try {
        const { site, startDate } = req.query;
        const fromDate = startDate ? new Date(String(startDate)) : new Date("2026-04-01T00:00:00.000Z");
        const [manpowerList, tickets] = await Promise.all([
            prisma_1.prisma.masterManpower.findMany({
                select: {
                    employeeId: true,
                    fullName: true,
                    branchName: true,
                    jobPosition: true,
                    organization: true,
                },
            }),
            prisma_1.prisma.ticketUsageHistory.findMany({
                where: {
                    departureDate: {
                        gte: fromDate,
                    },
                    status: { in: ["Used", "Partial Refund"] },
                },
                orderBy: { departureDate: "asc" },
            }),
        ]);
        const mpMap = new Map();
        for (const m of manpowerList) {
            mpMap.set(m.employeeId, m);
        }
        // Filter tickets by site if specified
        const siteQuery = site ? String(site).trim().toLowerCase() : "all";
        const filteredTickets = tickets.filter((t) => {
            if (!siteQuery || siteQuery === "all")
                return true;
            const mp = mpMap.get(t.employeeId);
            const bn = (mp?.branchName || "").toLowerCase();
            if (siteQuery.includes("senyiur"))
                return bn.includes("senyiur");
            if (siteQuery.includes("pahu") || siteQuery.includes("muara"))
                return bn.includes("pahu");
            if (siteQuery.includes("jakarta") || siteQuery.includes("ho") || siteQuery.includes("head")) {
                return bn.includes("jakarta") || bn.includes("ho");
            }
            return true;
        });
        const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        const monthlyMap = {};
        const empMap = {};
        let totalCostYtd = 0;
        const uniqueEmployeesYtd = new Set();
        for (const t of filteredTickets) {
            const d = new Date(t.departureDate);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const mKey = `${y}-${String(m).padStart(2, "0")}`;
            const mLabel = `${monthNames[m]} ${y}`;
            if (!monthlyMap[mKey]) {
                monthlyMap[mKey] = {
                    month: mKey,
                    monthLabel: mLabel,
                    ticketCount: 0,
                    totalCost: 0,
                    employees: new Set(),
                    senyiurCost: 0,
                    pahuCost: 0,
                    hoCost: 0,
                    senyiurTickets: 0,
                    pahuTickets: 0,
                    hoTickets: 0,
                    cutiCount: 0,
                    dinasCount: 0,
                    onsiteCount: 0,
                };
            }
            const cost = Number(t.ticketCost) || 0;
            totalCostYtd += cost;
            uniqueEmployeesYtd.add(t.employeeId);
            monthlyMap[mKey].ticketCount++;
            monthlyMap[mKey].totalCost += cost;
            monthlyMap[mKey].employees.add(t.employeeId);
            const mp = mpMap.get(t.employeeId);
            const bn = (mp?.branchName || "").toLowerCase();
            if (bn.includes("senyiur")) {
                monthlyMap[mKey].senyiurCost += cost;
                monthlyMap[mKey].senyiurTickets++;
            }
            else if (bn.includes("pahu")) {
                monthlyMap[mKey].pahuCost += cost;
                monthlyMap[mKey].pahuTickets++;
            }
            else if (bn.includes("jakarta") || bn.includes("ho")) {
                monthlyMap[mKey].hoCost += cost;
                monthlyMap[mKey].hoTickets++;
            }
            const notesLow = (t.notes || "").toLowerCase();
            if (notesLow.includes("dinas")) {
                monthlyMap[mKey].dinasCount++;
            }
            else if (notesLow.includes("on site") || notesLow.includes("onsite")) {
                monthlyMap[mKey].onsiteCount++;
            }
            else {
                monthlyMap[mKey].cutiCount++;
            }
            // Track top manpower
            if (!empMap[t.employeeId]) {
                const siteNorm = bn.includes("senyiur")
                    ? "Senyiur"
                    : bn.includes("pahu")
                        ? "Muara Pahu"
                        : bn.includes("jakarta") || bn.includes("ho")
                            ? "Head Office Jakarta"
                            : mp?.branchName || "Other";
                empMap[t.employeeId] = {
                    employeeId: t.employeeId,
                    fullName: mp?.fullName || t.employeeId,
                    jobPosition: mp?.jobPosition || "-",
                    organization: mp?.organization || "-",
                    site: siteNorm,
                    ticketCount: 0,
                    totalCost: 0,
                };
            }
            empMap[t.employeeId].ticketCount++;
            empMap[t.employeeId].totalCost += cost;
        }
        const monthlyTrends = Object.values(monthlyMap).map((m) => ({
            ...m,
            manpowerCount: m.employees.size,
            employees: undefined,
        }));
        const topManpower = Object.values(empMap)
            .sort((a, b) => b.totalCost - a.totalCost)
            .slice(0, 10);
        const summaryYtd = {
            periodLabel: "April 2026 - Sekarang (YTD)",
            totalTicketsYtd: filteredTickets.length,
            totalCostYtd,
            totalUniqueManpowerYtd: uniqueEmployeesYtd.size,
            averageCostPerTicket: filteredTickets.length > 0 ? Math.round(totalCostYtd / filteredTickets.length) : 0,
            averageTicketsPerManpower: uniqueEmployeesYtd.size > 0 ? Number((filteredTickets.length / uniqueEmployeesYtd.size).toFixed(1)) : 0,
        };
        return res.status(200).json({
            success: true,
            data: {
                summaryYtd,
                monthlyTrends,
                topManpower,
            },
        });
    }
    catch (error) {
        console.error("Error in getTicketAnalytics:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal mengambil data analytics tiket: " + error.message,
        });
    }
}
/**
 * Helper to recalculate an employee's ManpowerTicketPlafon based on all their tickets in TicketUsageHistory
 */
async function recalculateEmployeePlafon(employeeId) {
    const [employee, tickets] = await Promise.all([
        prisma_1.prisma.masterManpower.findFirst({
            where: { employeeId: { equals: employeeId, mode: "insensitive" } },
            select: { jobPosition: true, fullName: true },
        }),
        prisma_1.prisma.ticketUsageHistory.findMany({
            where: {
                employeeId,
                status: { in: ["Used", "Partial Refund"] },
            },
            orderBy: { departureDate: "asc" },
        }),
    ]);
    const cycleDays = getResetCycleDays(employee?.jobPosition);
    const now = new Date();
    if (tickets.length === 0) {
        return prisma_1.prisma.manpowerTicketPlafon.upsert({
            where: { employeeId },
            update: {
                usedAmount: 0,
                lastDepartureDate: null,
                nextResetDate: null,
                ticketCount: 0,
                notes: `Belum ada tiket (Siklus ${cycleDays} hari)`,
            },
            create: {
                employeeId,
                plafonAmount: DEFAULT_PLAFON_AMOUNT,
                usedAmount: 0,
                lastDepartureDate: null,
                nextResetDate: null,
                ticketCount: 0,
                notes: `Belum ada tiket (Siklus ${cycleDays} hari)`,
            },
        });
    }
    let cycleStartDate = null;
    let cycleResetDate = null;
    let usedInCycle = 0;
    for (const t of tickets) {
        const d = new Date(t.departureDate);
        if (!cycleResetDate || d >= cycleResetDate) {
            cycleStartDate = d;
            cycleResetDate = new Date(d);
            cycleResetDate.setDate(cycleResetDate.getDate() + cycleDays);
            usedInCycle = Number(t.ticketCost) || 0;
        }
        else {
            usedInCycle += Number(t.ticketCost) || 0;
        }
    }
    const lastDep = tickets[tickets.length - 1].departureDate;
    const nextReset = cycleResetDate;
    const isActive = nextReset ? nextReset > now : false;
    const currentUsed = isActive ? usedInCycle : 0;
    const resetStr = nextReset ? nextReset.toISOString().split("T")[0] : "";
    const notesStr = isActive
        ? `Aktif siklus ${cycleDays} hari (berakhir ${resetStr})`
        : `Auto-reset ${cycleDays} hari ke Rp ${DEFAULT_PLAFON_AMOUNT.toLocaleString("id-ID")} pada ${resetStr}`;
    return prisma_1.prisma.manpowerTicketPlafon.upsert({
        where: { employeeId },
        update: {
            usedAmount: currentUsed,
            lastDepartureDate: lastDep,
            nextResetDate: nextReset,
            ticketCount: tickets.length,
            notes: notesStr,
        },
        create: {
            employeeId,
            plafonAmount: DEFAULT_PLAFON_AMOUNT,
            usedAmount: currentUsed,
            lastDepartureDate: lastDep,
            nextResetDate: nextReset,
            ticketCount: tickets.length,
            notes: notesStr,
        },
    });
}
/**
 * PUT /api/ticket-plafon/ticket/:id
 * Update an existing ticket record in TicketUsageHistory
 * Only allowed for authorized emails: dzaky.athariqf@bataramining.com, dellafajar@bataramining.com
 */
async function updateTicketUsageHistory(req, res) {
    try {
        const id = String(req.params.id);
        const { ticketNumber, destination, airline, departureDate, returnDate, ticketCost, notes, userEmail, } = req.body;
        const AUTHORIZED_EMAILS = [
            "dzaky.athariqf@bataramining.com",
            "dellafajar@bataramining.com",
        ];
        const emailNorm = String(userEmail || "").trim().toLowerCase();
        if (!AUTHORIZED_EMAILS.includes(emailNorm)) {
            return res.status(403).json({
                success: false,
                message: "Akses ditolak: Hanya dzaky.athariqf@bataramining.com dan dellafajar@bataramining.com yang memiliki hak akses untuk mengedit tiket.",
            });
        }
        const existing = await prisma_1.prisma.ticketUsageHistory.findUnique({
            where: { id },
        });
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Data tiket tidak ditemukan.",
            });
        }
        const costNum = ticketCost !== undefined ? Number(ticketCost) : existing.ticketCost;
        const depDate = departureDate ? new Date(departureDate) : existing.departureDate;
        const retDate = returnDate !== undefined ? (returnDate ? new Date(returnDate) : null) : existing.returnDate;
        const updated = await prisma_1.prisma.ticketUsageHistory.update({
            where: { id },
            data: {
                ticketNumber: ticketNumber !== undefined ? (ticketNumber ? String(ticketNumber).trim() : null) : existing.ticketNumber,
                destination: destination !== undefined ? (destination ? String(destination).trim() : null) : existing.destination,
                airline: airline !== undefined ? (airline ? String(airline).trim() : null) : existing.airline,
                departureDate: depDate,
                returnDate: retDate,
                ticketCost: costNum,
                notes: notes !== undefined ? (notes ? String(notes).trim() : null) : existing.notes,
            },
        });
        // Automatically recalculate employee's plafon balance and reset cycle
        const updatedPlafon = await recalculateEmployeePlafon(existing.employeeId);
        return res.status(200).json({
            success: true,
            message: "Data tiket berhasil diperbarui dan saldo plafon telah disinkronisasi.",
            data: {
                ticket: updated,
                plafon: updatedPlafon,
            },
        });
    }
    catch (error) {
        console.error("Error in updateTicketUsageHistory:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal memperbarui tiket: " + error.message,
        });
    }
}
/**
 * DELETE /api/ticket-plafon/ticket/:id
 * Delete a ticket record from TicketUsageHistory
 * Only allowed for authorized emails: dzaky.athariqf@bataramining.com, dellafajar@bataramining.com
 */
async function deleteTicketUsageHistory(req, res) {
    try {
        const id = String(req.params.id);
        const { userEmail } = req.query;
        const AUTHORIZED_EMAILS = [
            "dzaky.athariqf@bataramining.com",
            "dellafajar@bataramining.com",
        ];
        const emailNorm = String(userEmail || "").trim().toLowerCase();
        if (!AUTHORIZED_EMAILS.includes(emailNorm)) {
            return res.status(403).json({
                success: false,
                message: "Akses ditolak: Hanya dzaky.athariqf@bataramining.com dan dellafajar@bataramining.com yang memiliki hak akses untuk menghapus tiket.",
            });
        }
        const existing = await prisma_1.prisma.ticketUsageHistory.findUnique({
            where: { id },
        });
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Data tiket tidak ditemukan.",
            });
        }
        await prisma_1.prisma.ticketUsageHistory.delete({
            where: { id },
        });
        // Recalculate employee plafon
        const updatedPlafon = await recalculateEmployeePlafon(existing.employeeId);
        return res.status(200).json({
            success: true,
            message: "Tiket berhasil dihapus dan saldo plafon telah disinkronisasi.",
            data: { plafon: updatedPlafon },
        });
    }
    catch (error) {
        console.error("Error in deleteTicketUsageHistory:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal menghapus tiket: " + error.message,
        });
    }
}
/**
 * POST /api/ticket-plafon/ticket/:id/refund
 * Process ticket refund and return funds back to employee's plafon balance
 */
async function refundTicketUsageHistory(req, res) {
    try {
        const id = String(req.params.id);
        const { refundType = "FULL", refundAmount, refundDate, reason, notes, userEmail, } = req.body;
        const AUTHORIZED_EMAILS = [
            "dzaky.athariqf@bataramining.com",
            "dellafajar@bataramining.com",
        ];
        const emailNorm = String(userEmail || "").trim().toLowerCase();
        if (!AUTHORIZED_EMAILS.includes(emailNorm)) {
            return res.status(403).json({
                success: false,
                message: "Akses ditolak: Hanya dzaky.athariqf@bataramining.com dan dellafajar@bataramining.com yang memiliki hak akses untuk memproses refund tiket.",
            });
        }
        const existing = await prisma_1.prisma.ticketUsageHistory.findUnique({
            where: { id },
        });
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Data tiket tidak ditemukan.",
            });
        }
        if (existing.status === "Refunded") {
            return res.status(400).json({
                success: false,
                message: "Tiket ini sudah berstatus Refunded.",
            });
        }
        const originalCost = Number(existing.ticketCost) || 0;
        const isFull = refundType === "FULL";
        const refAmountNum = isFull ? originalCost : Number(refundAmount) || 0;
        if (refAmountNum <= 0 || refAmountNum > originalCost) {
            return res.status(400).json({
                success: false,
                message: `Nominal refund tidak valid (harus > 0 dan <= Rp ${originalCost.toLocaleString("id-ID")}).`,
            });
        }
        const remainingCost = originalCost - refAmountNum;
        const dateStr = refundDate
            ? new Date(refundDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0];
        const reasonStr = reason ? String(reason).trim() : "Pembatalan Tiket";
        const additionalNotes = notes ? ` - ${String(notes).trim()}` : "";
        let refundLog = "";
        let newStatus = "Refunded";
        let newCost = originalCost;
        if (isFull) {
            newStatus = "Refunded";
            newCost = originalCost; // Tetap simpan nilai asli tiket untuk riwayat, tapi status='Refunded' sehingga tidak memotong plafon
            refundLog = `[REFUND PENUH: Rp ${originalCost.toLocaleString("id-ID")} dikembalikan ke plafon pada ${dateStr}. Alasan: ${reasonStr}${additionalNotes}]`;
        }
        else {
            newStatus = "Partial Refund";
            newCost = remainingCost; // Biaya yang tetap terpotong di plafon (misal cancellation fee)
            refundLog = `[REFUND SEBAGIAN: Rp ${refAmountNum.toLocaleString("id-ID")} dikembalikan ke plafon (Biaya tetap terpakai: Rp ${remainingCost.toLocaleString("id-ID")}) pada ${dateStr}. Alasan: ${reasonStr}${additionalNotes}]`;
        }
        const updatedNotes = existing.notes
            ? `${existing.notes} | ${refundLog}`
            : refundLog;
        const updatedTicket = await prisma_1.prisma.ticketUsageHistory.update({
            where: { id },
            data: {
                status: newStatus,
                ticketCost: newCost,
                notes: updatedNotes,
            },
        });
        // Otomatis sinkronisasi dan hitung ulang plafon karyawan (dana kembali ke plafon)
        const updatedPlafon = await recalculateEmployeePlafon(existing.employeeId);
        return res.status(200).json({
            success: true,
            message: `Refund tiket berhasil diproses! Dana sebesar Rp ${refAmountNum.toLocaleString("id-ID")} telah dikembalikan ke saldo plafon karyawan.`,
            data: {
                ticket: updatedTicket,
                plafon: updatedPlafon,
                refundedAmount: refAmountNum,
            },
        });
    }
    catch (error) {
        console.error("Error in refundTicketUsageHistory:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal memproses refund tiket: " + error.message,
        });
    }
}
/**
 * POST /api/ticket-plafon/ticket/:id/cancel-refund
 * Cancel refund status and restore ticket back to "Used"
 */
async function cancelRefundTicketUsageHistory(req, res) {
    try {
        const id = String(req.params.id);
        const { userEmail } = req.body;
        const AUTHORIZED_EMAILS = [
            "dzaky.athariqf@bataramining.com",
            "dellafajar@bataramining.com",
        ];
        const emailNorm = String(userEmail || "").trim().toLowerCase();
        if (!AUTHORIZED_EMAILS.includes(emailNorm)) {
            return res.status(403).json({
                success: false,
                message: "Akses ditolak: Hanya dzaky.athariqf@bataramining.com dan dellafajar@bataramining.com yang memiliki hak akses untuk membatalkan refund.",
            });
        }
        const existing = await prisma_1.prisma.ticketUsageHistory.findUnique({
            where: { id },
        });
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Data tiket tidak ditemukan.",
            });
        }
        const updatedTicket = await prisma_1.prisma.ticketUsageHistory.update({
            where: { id },
            data: {
                status: "Used",
                notes: existing.notes
                    ? `${existing.notes} | [STATUS REFUND DIBATALKAN KEMBALI KE USED]`
                    : `[STATUS REFUND DIBATALKAN KEMBALI KE USED]`,
            },
        });
        const updatedPlafon = await recalculateEmployeePlafon(existing.employeeId);
        return res.status(200).json({
            success: true,
            message: "Status refund berhasil dibatalkan dan tiket kembali memotong plafon.",
            data: {
                ticket: updatedTicket,
                plafon: updatedPlafon,
            },
        });
    }
    catch (error) {
        console.error("Error in cancelRefundTicketUsageHistory:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal membatalkan refund: " + error.message,
        });
    }
}
