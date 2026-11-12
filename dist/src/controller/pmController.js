"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pmController = void 0;
const prisma_1 = require("../lib/prisma");
const volvoClient_1 = require("../lib/volvoClient");
const plantHelpers_1 = require("../lib/plantHelpers");
const DEFAULT_DAILY_PM_TARGET = 4;
const PM_GL_ACCOUNT_CODES = [
    "05110204", // BEBAN OLI
    "05110205", // BEBAN GREASE
    "05110301", // BEBAN SPAREPART
    "05110305", // BEBAN EKSTERNAL SERVICES
];
/**
 * Helper to fetch latest non-overlapping monthly GLPeriod IDs
 */
async function getLatestMonthlyPeriodIds() {
    const periods = await prisma_1.prisma.gLPeriod.findMany({
        orderBy: [{ year: "desc" }, { month: "desc" }, { endDate: "desc" }, { createdAt: "desc" }],
        select: { id: true, year: true, month: true },
    });
    const latestByMonth = new Map();
    for (const p of periods) {
        const key = `${p.year}-${p.month}`;
        if (!latestByMonth.has(key)) {
            latestByMonth.set(key, p.id);
        }
    }
    return Array.from(latestByMonth.values());
}
/**
 * Resolves a GL transaction's target Prime Mover unitCode (e.g. "PM454")
 * from costCenter or remark (supports PM/ST/DL codes mapped to their Prime Mover).
 */
function extractHeadUnitCodes(costCenter, remark, trailerToHeadMap) {
    const matchedHeads = new Set();
    const sources = [costCenter || "", remark || ""];
    for (const src of sources) {
        const matches = src.matchAll(/\b(PM|ST|DL)\s*-?\s*(\d{3})\b/gi);
        for (const m of matches) {
            const prefix = m[1].toUpperCase();
            const num = m[2];
            const fullCode = `${prefix}${num}`;
            if (prefix === "PM") {
                matchedHeads.add(fullCode);
            }
            else {
                const mappedHead = trailerToHeadMap.get(fullCode);
                matchedHeads.add(mappedHead || `PM${num}`);
            }
        }
    }
    return Array.from(matchedHeads);
}
/**
 * Evaluates a single unit's live KM & HM readiness against standard PM intervals
 * (12,000 / 24,000 / 48,000 KM & 250 / 500 / 1,000 / 2,000 HM)
 */
function evaluateUnitPmReadiness(params) {
    const { liveKm, liveHm, hasTelemetry, lastCompletedPm } = params;
    const cycleKmMilestone = liveKm > 0 ? Math.ceil((liveKm + 1) / 12000) * 12000 : 12000;
    const cycleHmMilestone = liveHm > 0 ? Math.ceil((liveHm + 1) / 250) * 250 : 250;
    const targetKm = lastCompletedPm?.nextDueKm != null && lastCompletedPm.nextDueKm > 0
        ? Math.round(lastCompletedPm.nextDueKm)
        : cycleKmMilestone;
    const targetHm = lastCompletedPm?.nextDueHm != null && lastCompletedPm.nextDueHm > 0
        ? Math.round(lastCompletedPm.nextDueHm * 10) / 10
        : cycleHmMilestone;
    const remainingKm = Math.round(targetKm - liveKm);
    const remainingHm = Math.round((targetHm - liveHm) * 10) / 10;
    const getKmLabel = (kmTarget) => {
        if (kmTarget > 0 && kmTarget % 48000 === 0)
            return "PS3 (48.000 KM)";
        if (kmTarget > 0 && kmTarget % 24000 === 0)
            return "PS2 (24.000 KM)";
        return "PS1 (12.000 KM)";
    };
    const getHmLabel = (hmTarget) => {
        const rounded = Math.round(hmTarget);
        if (rounded > 0 && rounded % 2000 === 0)
            return "P4 (2000 HM)";
        if (rounded > 0 && rounded % 1000 === 0)
            return "P3 (1000 HM)";
        if (rounded > 0 && rounded % 500 === 0)
            return "P2 (500 HM)";
        return "P1 (250 HM)";
    };
    const kmServiceLabel = getKmLabel(targetKm);
    const hmServiceLabel = getHmLabel(targetHm);
    let readinessStatus = "Safe";
    if (!hasTelemetry) {
        readinessStatus = "No Telemetry";
    }
    else if (remainingKm <= 0 || remainingHm <= 0) {
        readinessStatus = "Overdue";
    }
    else if (remainingKm <= 1500 || remainingHm <= 30) {
        readinessStatus = "Due Soon";
    }
    // Recommend the service tier that is closest or already due
    const recommendedServiceType = remainingKm <= 1500
        ? kmServiceLabel
        : remainingHm <= 30
            ? hmServiceLabel
            : kmServiceLabel;
    return {
        targetKm,
        targetHm,
        remainingKm,
        remainingHm,
        kmServiceLabel,
        hmServiceLabel,
        recommendedServiceType,
        readinessStatus,
    };
}
/** Normalizes up to 5 mechanic names into both an array and a comma-joined display string. */
function resolveMechanicsPayload(mechanicNames, mechanicName, inspectorName) {
    if (Array.isArray(mechanicNames)) {
        const cleaned = mechanicNames
            .map((n) => String(n || "").trim())
            .filter(Boolean)
            .slice(0, 5);
        return {
            namesArray: cleaned,
            joinedString: cleaned.length > 0 ? cleaned.join(", ") : null,
        };
    }
    const raw = mechanicName !== undefined ? mechanicName : inspectorName;
    if (raw !== undefined) {
        const str = String(raw || "").trim();
        const split = str
            ? str
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 5)
            : [];
        return {
            namesArray: split,
            joinedString: split.length > 0 ? split.join(", ") : null,
        };
    }
    return {};
}
/**
 * Resolves optional PS companion trailers (`buntutSummary`) only when explicitly selected.
 * Unlike Periodic Inspection, Periodic Service on a Head does NOT auto-include Dolly & Vessel.
 */
function resolveOptionalBuntutSummary(buntutSummary, includedTrailers) {
    if (Array.isArray(includedTrailers)) {
        const cleaned = includedTrailers
            .map((c) => String(c || "").trim().toUpperCase())
            .filter(Boolean);
        return cleaned.length > 0 ? cleaned.join(", ") : null;
    }
    if (buntutSummary !== undefined) {
        const str = String(buntutSummary || "").trim();
        return str.length > 0 ? str : null;
    }
    return undefined;
}
exports.pmController = {
    // -------------------------------------------------------------
    // 1. WEEKLY PREVENTIVE MAINTENANCE SCHEDULE
    // -------------------------------------------------------------
    getPmWeeklySchedule: async (req, res) => {
        try {
            const { date, site, startDate: qStartDate, endDate: qEndDate } = req.query;
            const jobSite = site || "MuaraPahu";
            const { startDate, endDate, dates } = qStartDate && qEndDate
                ? (0, plantHelpers_1.getDateRange)(qStartDate, qEndDate)
                : (0, plantHelpers_1.getWeekRange)(date);
            const globalTargetSetting = await prisma_1.prisma.plantSetting.findUnique({
                where: { key: "daily_pm_target" },
            });
            const defaultDailyTarget = globalTargetSetting
                ? parseInt(globalTargetSetting.value, 10) || DEFAULT_DAILY_PM_TARGET
                : DEFAULT_DAILY_PM_TARGET;
            const [{ primeMoverPopulation, totalPopulationAllSites }, existingPlans, telemetry,] = await Promise.all([
                (0, plantHelpers_1.getSiteUnitPopulations)(jobSite),
                prisma_1.prisma.preventiveMaintenancePlan.findMany({
                    where: { jobSite, date: { in: dates } },
                    include: {
                        items: {
                            include: { unit: true },
                            orderBy: [{ shift: "asc" }, { unitCode: "asc" }],
                        },
                    },
                }),
                (0, volvoClient_1.getVolvoTelemetryMap)(),
            ]);
            const planByDate = {};
            for (const p of existingPlans) {
                planByDate[p.date] = p;
            }
            let totalWeekPlan = 0;
            let totalWeekScheduled = 0;
            let totalWeekCompleted = 0;
            const todayStr = new Date().toISOString().slice(0, 10);
            const days = dates.map((dStr) => {
                const plan = planByDate[dStr];
                const targetUnits = plan && plan.targetUnits !== undefined ? plan.targetUnits : defaultDailyTarget;
                const items = (plan?.items || []).map((item) => {
                    const isHead = !item.unit || item.unit.category === "Prime Mover";
                    const tel = isHead ? telemetry.map.get(item.unitCode) : undefined;
                    return {
                        ...item,
                        inspectorName: item.mechanicName || null,
                        liveKm: tel?.km ?? null,
                        liveHm: tel?.hm ?? null,
                        buntutSummary: item.buntutSummary || "",
                    };
                });
                const scheduledCount = items.length;
                const completedCount = items.filter((it) => it.status === "Completed").length;
                const inProgressCount = items.filter((it) => it.status === "In Progress").length;
                totalWeekPlan += targetUnits;
                totalWeekScheduled += scheduledCount;
                totalWeekCompleted += completedCount;
                return {
                    date: dStr,
                    dayName: (0, plantHelpers_1.getIndoDayName)(dStr),
                    dayDateFormatted: (0, plantHelpers_1.formatIndoDate)(dStr),
                    isToday: dStr === todayStr,
                    targetUnits,
                    hasCustomTarget: plan && plan.targetUnits !== undefined,
                    leadInspector: plan?.leadMechanic || null,
                    leadMechanic: plan?.leadMechanic || null,
                    scheduledCount,
                    completedCount,
                    inProgressCount,
                    isTargetAchieved: completedCount >= targetUnits && targetUnits > 0,
                    notes: plan?.notes || null,
                    items,
                };
            });
            const scheduledPercent = totalWeekPlan > 0 ? Math.round((totalWeekScheduled / totalWeekPlan) * 100) : 0;
            const achievementPercent = totalWeekPlan > 0 ? Math.round((totalWeekCompleted / totalWeekPlan) * 100) : 0;
            return res.json({
                success: true,
                data: {
                    weekRange: {
                        startDate,
                        endDate,
                        formatted: `${(0, plantHelpers_1.formatIndoDate)(startDate)} - ${(0, plantHelpers_1.formatIndoDate)(endDate)}`,
                    },
                    defaultDailyTarget,
                    selectedSite: jobSite,
                    primeMoverPopulation,
                    totalPopulationAllSites,
                    telemetryMeta: {
                        onlineCount: telemetry.onlineCount,
                        fetchedAt: telemetry.fetchedAt,
                        error: telemetry.error || null,
                    },
                    summary: {
                        totalWeekPlan,
                        totalWeekScheduled,
                        totalWeekCompleted,
                        scheduledPercent,
                        achievementPercent,
                    },
                    days,
                },
            });
        }
        catch (error) {
            console.error("getPmWeeklySchedule error:", error);
            return res.status(500).json({ success: false, error: error.message });
        }
    },
    // -------------------------------------------------------------
    // 2. DAILY PLAN TARGET & LEAD MECHANIC UPDATE
    // -------------------------------------------------------------
    upsertPmDailyPlan: async (req, res) => {
        try {
            const { date, targetUnits, notes, leadMechanic, leadInspector, jobSite = "MuaraPahu", } = req.body;
            if (!date) {
                return res
                    .status(400)
                    .json({ success: false, message: "Tanggal (date) wajib diisi" });
            }
            let numTarget = undefined;
            if (targetUnits !== undefined && targetUnits !== null && targetUnits !== "") {
                const parsed = parseInt(targetUnits, 10);
                if (isNaN(parsed) || parsed < 0) {
                    return res
                        .status(400)
                        .json({ success: false, message: "Target units harus angka valid >= 0" });
                }
                numTarget = parsed;
            }
            const resolvedLead = leadMechanic !== undefined ? leadMechanic : leadInspector;
            const plan = await prisma_1.prisma.preventiveMaintenancePlan.upsert({
                where: { jobSite_date: { jobSite, date } },
                update: {
                    ...(numTarget !== undefined ? { targetUnits: numTarget } : {}),
                    ...(resolvedLead !== undefined ? { leadMechanic: resolvedLead || null } : {}),
                    ...(notes !== undefined ? { notes: notes || null } : {}),
                },
                create: {
                    jobSite,
                    date,
                    targetUnits: numTarget !== undefined ? numTarget : DEFAULT_DAILY_PM_TARGET,
                    leadMechanic: resolvedLead || null,
                    notes: notes || null,
                },
            });
            return res.json({
                success: true,
                message: `Plan Periodic Service tanggal ${(0, plantHelpers_1.formatIndoDate)(date)} berhasil diperbarui`,
                data: plan,
            });
        }
        catch (error) {
            console.error("upsertPmDailyPlan error:", error);
            return res.status(500).json({ success: false, error: error.message });
        }
    },
    // -------------------------------------------------------------
    // 3. ADD / SCHEDULE UNIT FOR PERIODIC SERVICE
    // -------------------------------------------------------------
    addPmItem: async (req, res) => {
        try {
            const { date, unitCode, serviceType = "PS1 (12.000 KM)", shift = "Shift 1", status = "Scheduled", category = "Scheduled PS", planStartTime, planLeadTime, planHmServis, supervisorName, mechanicNames, mechanicName, inspectorName, buntutSummary: rawBuntutSummary, includedTrailers, currentKm, currentHm, nextDueKm, nextDueHm, notes, jobSite = "MuaraPahu", } = req.body;
            if (!date || !unitCode) {
                return res.status(400).json({
                    success: false,
                    message: "Tanggal dan Kode Unit wajib diisi",
                });
            }
            const normalizedUnitCode = (0, plantHelpers_1.normalizeHeadCode)(unitCode);
            const [masterUnit, globalTargetSetting, telemetry] = await Promise.all([
                prisma_1.prisma.masterUnit.findUnique({ where: { unitCode: normalizedUnitCode } }),
                prisma_1.prisma.plantSetting.findUnique({ where: { key: "daily_pm_target" } }),
                (0, volvoClient_1.getVolvoTelemetryMap)(),
            ]);
            const isHead = !masterUnit || masterUnit.category === "Prime Mover";
            const resolvedBuntut = isHead
                ? resolveOptionalBuntutSummary(rawBuntutSummary, includedTrailers)
                : null;
            const defaultTarget = globalTargetSetting
                ? parseInt(globalTargetSetting.value, 10) || DEFAULT_DAILY_PM_TARGET
                : DEFAULT_DAILY_PM_TARGET;
            const tel = isHead ? telemetry.map.get(normalizedUnitCode) : undefined;
            const resolvedKm = currentKm !== undefined && currentKm !== null && currentKm !== ""
                ? Number(currentKm)
                : tel?.km ?? null;
            const resolvedHm = currentHm !== undefined && currentHm !== null && currentHm !== ""
                ? Number(currentHm)
                : tel?.hm ?? null;
            const autoTargets = (0, plantHelpers_1.computePmTargets)(serviceType, resolvedKm, resolvedHm);
            const resolvedNextKm = nextDueKm !== undefined && nextDueKm !== null && nextDueKm !== ""
                ? Number(nextDueKm)
                : autoTargets.nextDueKm;
            const resolvedNextHm = nextDueHm !== undefined && nextDueHm !== null && nextDueHm !== ""
                ? Number(nextDueHm)
                : autoTargets.nextDueHm;
            const mechResolved = resolveMechanicsPayload(mechanicNames, mechanicName, inspectorName);
            const plan = await prisma_1.prisma.preventiveMaintenancePlan.upsert({
                where: { jobSite_date: { jobSite, date } },
                update: {},
                create: { jobSite, date, targetUnits: defaultTarget },
            });
            const item = await prisma_1.prisma.preventiveMaintenanceItem.upsert({
                where: { planId_unitCode: { planId: plan.id, unitCode: normalizedUnitCode } },
                update: {
                    serviceType,
                    shift,
                    status,
                    category: category || "Scheduled PS",
                    planStartTime: planStartTime !== undefined ? planStartTime || null : undefined,
                    planLeadTime: planLeadTime !== undefined ? planLeadTime || null : undefined,
                    planHmServis: planHmServis !== undefined ? planHmServis || null : undefined,
                    supervisorName: supervisorName !== undefined ? supervisorName || null : undefined,
                    ...(mechResolved.joinedString !== undefined
                        ? {
                            mechanicName: mechResolved.joinedString,
                            mechanicNames: mechResolved.namesArray || [],
                        }
                        : {}),
                    currentKm: resolvedKm ?? undefined,
                    currentHm: resolvedHm ?? undefined,
                    nextDueKm: resolvedNextKm ?? undefined,
                    nextDueHm: resolvedNextHm ?? undefined,
                    notes: notes !== undefined ? notes || null : undefined,
                    ...(resolvedBuntut !== undefined ? { buntutSummary: resolvedBuntut } : {}),
                },
                create: {
                    planId: plan.id,
                    date,
                    unitCode: normalizedUnitCode,
                    serviceType,
                    shift,
                    status,
                    category: category || "Scheduled PS",
                    planStartTime: planStartTime || null,
                    planLeadTime: planLeadTime || null,
                    planHmServis: planHmServis || null,
                    supervisorName: supervisorName || null,
                    mechanicName: mechResolved.joinedString ?? null,
                    mechanicNames: mechResolved.namesArray || [],
                    currentKm: resolvedKm,
                    currentHm: resolvedHm,
                    nextDueKm: resolvedNextKm,
                    nextDueHm: resolvedNextHm,
                    notes: notes || null,
                    buntutSummary: resolvedBuntut ?? null,
                },
                include: { unit: true },
            });
            return res.json({
                success: true,
                message: `Unit ${normalizedUnitCode} berhasil dijadwalkan Periodic Service untuk ${(0, plantHelpers_1.formatIndoDate)(date)}`,
                data: {
                    ...item,
                    buntutSummary: item.buntutSummary || "",
                    inspectorName: item.mechanicName || null,
                    liveKm: tel?.km ?? null,
                    liveHm: tel?.hm ?? null,
                },
            });
        }
        catch (error) {
            console.error("addPmItem error:", error);
            return res.status(500).json({ success: false, error: error.message });
        }
    },
    // -------------------------------------------------------------
    // 4. BULK ADD UNITS FOR PM
    // -------------------------------------------------------------
    bulkAddPmItems: async (req, res) => {
        try {
            const { date, unitCodes, serviceType = "PS1 (12.000 KM)", shift = "Shift 1", jobSite = "MuaraPahu", } = req.body;
            if (!date || !Array.isArray(unitCodes) || unitCodes.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Tanggal dan daftar kode unit wajib diisi",
                });
            }
            const normalizedCodes = unitCodes.map((rawCode) => (0, plantHelpers_1.normalizeHeadCode)(rawCode));
            const [matchedUnits, globalTargetSetting, telemetry] = await Promise.all([
                prisma_1.prisma.masterUnit.findMany({
                    where: { unitCode: { in: normalizedCodes } },
                    select: { unitCode: true, category: true },
                }),
                prisma_1.prisma.plantSetting.findUnique({ where: { key: "daily_pm_target" } }),
                (0, volvoClient_1.getVolvoTelemetryMap)(),
            ]);
            const categoryMap = new Map(matchedUnits.map((u) => [u.unitCode, u.category]));
            const defaultTarget = globalTargetSetting
                ? parseInt(globalTargetSetting.value, 10) || DEFAULT_DAILY_PM_TARGET
                : DEFAULT_DAILY_PM_TARGET;
            const plan = await prisma_1.prisma.preventiveMaintenancePlan.upsert({
                where: { jobSite_date: { jobSite, date } },
                update: {},
                create: { jobSite, date, targetUnits: defaultTarget },
            });
            const results = [];
            for (const code of normalizedCodes) {
                const isHead = !categoryMap.has(code) || categoryMap.get(code) === "Prime Mover";
                const tel = isHead ? telemetry.map.get(code) : undefined;
                const currentKm = tel?.km ?? null;
                const currentHm = tel?.hm ?? null;
                const { nextDueKm, nextDueHm } = (0, plantHelpers_1.computePmTargets)(serviceType, currentKm, currentHm);
                const item = await prisma_1.prisma.preventiveMaintenanceItem.upsert({
                    where: { planId_unitCode: { planId: plan.id, unitCode: code } },
                    update: {
                        serviceType,
                        shift,
                        ...(currentKm !== null ? { currentKm } : {}),
                        ...(currentHm !== null ? { currentHm } : {}),
                        ...(nextDueKm !== null ? { nextDueKm } : {}),
                        ...(nextDueHm !== null ? { nextDueHm } : {}),
                    },
                    create: {
                        planId: plan.id,
                        date,
                        unitCode: code,
                        serviceType,
                        shift,
                        status: "Scheduled",
                        currentKm,
                        currentHm,
                        nextDueKm,
                        nextDueHm,
                        buntutSummary: null,
                    },
                });
                results.push(item);
            }
            return res.json({
                success: true,
                message: `${results.length} unit berhasil dijadwalkan Periodic Service untuk ${(0, plantHelpers_1.formatIndoDate)(date)}`,
                data: results,
            });
        }
        catch (error) {
            console.error("bulkAddPmItems error:", error);
            return res.status(500).json({ success: false, error: error.message });
        }
    },
    // -------------------------------------------------------------
    // 5. UPDATE PERIODIC SERVICE ITEM
    // -------------------------------------------------------------
    updatePmItem: async (req, res) => {
        try {
            const id = String(req.params.id);
            const { serviceType, shift, status, category, planStartTime, planLeadTime, planHmServis, supervisorName, mechanicNames, mechanicName, inspectorName, buntutSummary: rawBuntutSummary, includedTrailers, currentKm, currentHm, nextDueKm, nextDueHm, notes, } = req.body;
            const existing = await prisma_1.prisma.preventiveMaintenanceItem.findUnique({
                where: { id },
                include: { unit: true },
            });
            if (!existing) {
                return res
                    .status(404)
                    .json({ success: false, message: "Jadwal Periodic Service tidak ditemukan" });
            }
            const isHead = !existing.unit || existing.unit.category === "Prime Mover";
            const mechResolved = resolveMechanicsPayload(mechanicNames, mechanicName, inspectorName);
            const resolvedBuntut = isHead
                ? resolveOptionalBuntutSummary(rawBuntutSummary, includedTrailers)
                : null;
            const effectiveService = serviceType || existing.serviceType;
            let resolvedKm = currentKm !== undefined ? (currentKm === null || currentKm === "" ? null : Number(currentKm)) : existing.currentKm;
            let resolvedHm = currentHm !== undefined ? (currentHm === null || currentHm === "" ? null : Number(currentHm)) : existing.currentHm;
            // On completion of a Prime Mover, capture live Volvo KM/HM if still missing
            if (isHead && status === "Completed" && (resolvedKm == null || resolvedHm == null)) {
                const telemetry = await (0, volvoClient_1.getVolvoTelemetryMap)();
                const tel = telemetry.map.get(existing.unitCode);
                if (tel) {
                    if (resolvedKm == null)
                        resolvedKm = tel.km;
                    if (resolvedHm == null)
                        resolvedHm = tel.hm;
                }
            }
            const computed = (0, plantHelpers_1.computePmTargets)(effectiveService, resolvedKm, resolvedHm);
            const resolvedNextKm = nextDueKm !== undefined
                ? nextDueKm === null || nextDueKm === ""
                    ? null
                    : Number(nextDueKm)
                : status === "Completed" && computed.nextDueKm != null
                    ? computed.nextDueKm
                    : existing.nextDueKm;
            const resolvedNextHm = nextDueHm !== undefined
                ? nextDueHm === null || nextDueHm === ""
                    ? null
                    : Number(nextDueHm)
                : status === "Completed" && computed.nextDueHm != null
                    ? computed.nextDueHm
                    : existing.nextDueHm;
            const updated = await prisma_1.prisma.preventiveMaintenanceItem.update({
                where: { id },
                data: {
                    serviceType: serviceType || undefined,
                    shift: shift || undefined,
                    status: status || undefined,
                    category: category !== undefined ? category || "Scheduled PS" : undefined,
                    planStartTime: planStartTime !== undefined ? planStartTime || null : undefined,
                    planLeadTime: planLeadTime !== undefined ? planLeadTime || null : undefined,
                    planHmServis: planHmServis !== undefined ? planHmServis || null : undefined,
                    supervisorName: supervisorName !== undefined ? supervisorName || null : undefined,
                    ...(mechResolved.joinedString !== undefined
                        ? {
                            mechanicName: mechResolved.joinedString,
                            mechanicNames: mechResolved.namesArray || [],
                        }
                        : {}),
                    ...(resolvedBuntut !== undefined ? { buntutSummary: resolvedBuntut } : {}),
                    currentKm: resolvedKm,
                    currentHm: resolvedHm,
                    nextDueKm: resolvedNextKm,
                    nextDueHm: resolvedNextHm,
                    notes: notes !== undefined ? notes || null : undefined,
                },
                include: { unit: true },
            });
            return res.json({
                success: true,
                message: "Jadwal Periodic Service berhasil diperbarui",
                data: {
                    ...updated,
                    buntutSummary: updated.buntutSummary || "",
                    inspectorName: updated.mechanicName || null,
                },
            });
        }
        catch (error) {
            console.error("updatePmItem error:", error);
            return res.status(500).json({ success: false, error: error.message });
        }
    },
    // -------------------------------------------------------------
    // 6. DELETE PERIODIC SERVICE ITEM
    // -------------------------------------------------------------
    deletePmItem: async (req, res) => {
        try {
            const id = String(req.params.id);
            const existing = await prisma_1.prisma.preventiveMaintenanceItem.findUnique({ where: { id } });
            if (!existing) {
                return res
                    .status(404)
                    .json({ success: false, message: "Jadwal Periodic Service tidak ditemukan" });
            }
            await prisma_1.prisma.preventiveMaintenanceItem.delete({ where: { id } });
            return res.json({
                success: true,
                message: `Unit ${existing.unitCode} dihapus dari jadwal Periodic Service`,
            });
        }
        catch (error) {
            console.error("deletePmItem error:", error);
            return res.status(500).json({ success: false, error: error.message });
        }
    },
    // -------------------------------------------------------------
    // 7. AUTO-SCHEDULE DUE / OVERDUE UNITS FOR CURRENT WEEK
    // -------------------------------------------------------------
    autoScheduleDueUnits: async (req, res) => {
        try {
            const { date, jobSite = "MuaraPahu" } = req.body;
            const { startDate, endDate, dates } = (0, plantHelpers_1.getWeekRange)(date);
            const [units, telemetry, existingPlans, globalTargetSetting, completedItems] = await Promise.all([
                prisma_1.prisma.masterUnit.findMany({
                    where: { category: "Prime Mover", status: "Active", jobSite },
                    orderBy: { unitNumber: "asc" },
                }),
                (0, volvoClient_1.getVolvoTelemetryMap)(),
                prisma_1.prisma.preventiveMaintenancePlan.findMany({
                    where: { jobSite, date: { in: dates } },
                    include: { items: true },
                }),
                prisma_1.prisma.plantSetting.findUnique({ where: { key: "daily_pm_target" } }),
                prisma_1.prisma.preventiveMaintenanceItem.findMany({
                    where: { status: "Completed" },
                    orderBy: { date: "desc" },
                }),
            ]);
            const dailyTarget = globalTargetSetting
                ? parseInt(globalTargetSetting.value, 10) || DEFAULT_DAILY_PM_TARGET
                : DEFAULT_DAILY_PM_TARGET;
            const scheduledInWeek = new Set();
            const countByDate = new Map();
            for (const d of dates)
                countByDate.set(d, 0);
            for (const p of existingPlans) {
                countByDate.set(p.date, p.items.length);
                for (const it of p.items)
                    scheduledInWeek.add(it.unitCode);
            }
            const lastCompletedByUnit = new Map();
            for (const c of completedItems) {
                if (!lastCompletedByUnit.has(c.unitCode)) {
                    lastCompletedByUnit.set(c.unitCode, c);
                }
            }
            // Collect unscheduled Overdue / Due Soon units sorted by urgency
            const dueUnits = units
                .filter((u) => !scheduledInWeek.has(u.unitCode))
                .map((u) => {
                const tel = telemetry.map.get(u.unitCode);
                const evalRes = evaluateUnitPmReadiness({
                    liveKm: tel?.km ?? 0,
                    liveHm: tel?.hm ?? 0,
                    hasTelemetry: !!tel,
                    lastCompletedPm: lastCompletedByUnit.get(u.unitCode) || null,
                });
                return { unit: u, tel, evalRes };
            })
                .filter((x) => x.evalRes.readinessStatus === "Overdue" ||
                x.evalRes.readinessStatus === "Due Soon")
                .sort((a, b) => a.evalRes.remainingKm - b.evalRes.remainingKm);
            if (dueUnits.length === 0) {
                return res.json({
                    success: true,
                    scheduledCount: 0,
                    message: `Semua unit yang mendekati jadwal PM (<= 1.500 KM / <= 30 HM) di ${jobSite} sudah terjadwal di minggu ${(0, plantHelpers_1.formatIndoDate)(startDate)} s/d ${(0, plantHelpers_1.formatIndoDate)(endDate)}.`,
                });
            }
            // Distribute dueUnits evenly across days from today/startDate onward
            const todayStr = new Date().toISOString().slice(0, 10);
            const candidateDates = dates.filter((d) => d >= todayStr);
            const targetDates = candidateDates.length > 0 ? candidateDates : dates;
            let inserted = 0;
            let dateCursor = 0;
            for (const entry of dueUnits) {
                // Find next day with spare capacity or cycle round-robin
                let chosenDate = targetDates[dateCursor % targetDates.length];
                for (let offset = 0; offset < targetDates.length; offset++) {
                    const d = targetDates[(dateCursor + offset) % targetDates.length];
                    if ((countByDate.get(d) || 0) < dailyTarget) {
                        chosenDate = d;
                        break;
                    }
                }
                dateCursor++;
                countByDate.set(chosenDate, (countByDate.get(chosenDate) || 0) + 1);
                const plan = await prisma_1.prisma.preventiveMaintenancePlan.upsert({
                    where: { jobSite_date: { jobSite, date: chosenDate } },
                    update: {},
                    create: { jobSite, date: chosenDate, targetUnits: dailyTarget },
                });
                await prisma_1.prisma.preventiveMaintenanceItem.upsert({
                    where: { planId_unitCode: { planId: plan.id, unitCode: entry.unit.unitCode } },
                    update: {},
                    create: {
                        planId: plan.id,
                        date: chosenDate,
                        unitCode: entry.unit.unitCode,
                        serviceType: entry.evalRes.recommendedServiceType,
                        shift: "Shift 1",
                        status: "Scheduled",
                        currentKm: entry.tel?.km ?? null,
                        currentHm: entry.tel?.hm ?? null,
                        nextDueKm: entry.evalRes.targetKm,
                        nextDueHm: entry.evalRes.targetHm,
                        notes: `Auto-Radar Volvo (${entry.evalRes.readinessStatus}: sisa ${entry.evalRes.remainingKm.toLocaleString("id-ID")} KM)`,
                        buntutSummary: null,
                    },
                });
                inserted++;
            }
            return res.json({
                success: true,
                scheduledCount: inserted,
                message: `${inserted} unit Overdue/Due Soon berhasil dijadwalkan otomatis pada minggu ${(0, plantHelpers_1.formatIndoDate)(startDate)} s/d ${(0, plantHelpers_1.formatIndoDate)(endDate)}.`,
            });
        }
        catch (error) {
            console.error("autoScheduleDueUnits error:", error);
            return res.status(500).json({ success: false, error: error.message });
        }
    },
    // -------------------------------------------------------------
    // 8. PM READINESS RADAR & GL SERVICE HISTORY PER UNIT
    // -------------------------------------------------------------
    getPmRadar: async (req, res) => {
        try {
            const siteParam = req.query.site ? String(req.query.site) : "ALL";
            const forceRefresh = req.query.force === "true";
            const unitWhere = { category: "Prime Mover" };
            if (siteParam && siteParam !== "ALL") {
                unitWhere.jobSite = siteParam;
            }
            const [primeMovers, allTrailers, trailerSummaryMap, telemetry, allPmItems, periodIds,] = await Promise.all([
                prisma_1.prisma.masterUnit.findMany({
                    where: unitWhere,
                    orderBy: { unitNumber: "asc" },
                }),
                prisma_1.prisma.masterUnit.findMany({
                    where: { category: { not: "Prime Mover" }, headUnitCode: { not: null } },
                    select: { unitCode: true, headUnitCode: true },
                }),
                (0, plantHelpers_1.getTrailerSummaryMap)(),
                (0, volvoClient_1.getVolvoTelemetryMap)(forceRefresh),
                prisma_1.prisma.preventiveMaintenanceItem.findMany({
                    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
                }),
                getLatestMonthlyPeriodIds(),
            ]);
            const trailerToHeadMap = new Map();
            for (const t of allTrailers) {
                if (t.headUnitCode) {
                    trailerToHeadMap.set(t.unitCode.toUpperCase(), t.headUnitCode.toUpperCase());
                }
            }
            // Query PM-related GL transactions from deduplicated monthly periods
            const glRows = periodIds.length > 0
                ? await prisma_1.prisma.gLTransaction.findMany({
                    where: {
                        periodId: { in: periodIds },
                        accountCode: { in: PM_GL_ACCOUNT_CODES },
                    },
                    orderBy: [{ date: "desc" }],
                })
                : [];
            // Group PM items by unitCode
            const lastCompletedByUnit = new Map();
            const activeScheduleByUnit = new Map();
            for (const item of allPmItems) {
                if (item.status === "Completed" && !lastCompletedByUnit.has(item.unitCode)) {
                    lastCompletedByUnit.set(item.unitCode, item);
                }
                if ((item.status === "Scheduled" || item.status === "In Progress") &&
                    !activeScheduleByUnit.has(item.unitCode)) {
                    activeScheduleByUnit.set(item.unitCode, item);
                }
            }
            // Group GL PM/Maintenance transactions per Prime Mover unitCode
            const glByUnit = new Map();
            const isScheduledPmRemark = (remark) => Boolean(remark &&
                /(schedule|schdule|scjedule|ps\s*\d|12000|24000|48000|250\s*hm|500\s*hm|1000\s*hm|greasing|ganti\s*oli|service)/i.test(remark));
            for (const r of glRows) {
                const heads = extractHeadUnitCodes(r.costCenter, r.remark, trailerToHeadMap);
                if (heads.length === 0)
                    continue;
                const isPmTagged = isScheduledPmRemark(r.remark);
                for (const unitCode of heads) {
                    if (!glByUnit.has(unitCode)) {
                        glByUnit.set(unitCode, {
                            oilCost: 0,
                            greaseCost: 0,
                            sparepartCost: 0,
                            externalCost: 0,
                            totalCost: 0,
                            txCount: 0,
                            lastServiceDate: null,
                            lastServiceRemark: null,
                            history: [],
                        });
                    }
                    const agg = glByUnit.get(unitCode);
                    const shareAmount = (r.debet || 0) / heads.length;
                    if (r.accountCode === "05110204")
                        agg.oilCost += shareAmount;
                    else if (r.accountCode === "05110205")
                        agg.greaseCost += shareAmount;
                    else if (r.accountCode === "05110301")
                        agg.sparepartCost += shareAmount;
                    else if (r.accountCode === "05110305")
                        agg.externalCost += shareAmount;
                    agg.totalCost += shareAmount;
                    agg.txCount++;
                    if (isPmTagged && !agg.lastServiceDate) {
                        agg.lastServiceDate = r.date;
                        agg.lastServiceRemark = r.remark;
                    }
                    if (agg.history.length < 30) {
                        agg.history.push({
                            id: r.id,
                            date: r.date,
                            regNo: r.regNo || "-",
                            accountCode: r.accountCode,
                            accountName: r.accountName,
                            specification: r.specification || "-",
                            qty: r.qty || 0,
                            debet: shareAmount,
                            remark: r.remark || "-",
                            isScheduledPm: isPmTagged,
                        });
                    }
                }
            }
            // Build unified Radar rows
            const radarUnits = primeMovers.map((u) => {
                const tel = telemetry.map.get(u.unitCode);
                const lastCompleted = lastCompletedByUnit.get(u.unitCode) || null;
                const activeSchedule = activeScheduleByUnit.get(u.unitCode) || null;
                const glStats = glByUnit.get(u.unitCode) || {
                    oilCost: 0,
                    greaseCost: 0,
                    sparepartCost: 0,
                    externalCost: 0,
                    totalCost: 0,
                    txCount: 0,
                    lastServiceDate: null,
                    lastServiceRemark: null,
                    history: [],
                };
                const readiness = evaluateUnitPmReadiness({
                    liveKm: tel?.km ?? 0,
                    liveHm: tel?.hm ?? 0,
                    hasTelemetry: !!tel,
                    lastCompletedPm: lastCompleted,
                });
                return {
                    unitCode: u.unitCode,
                    unitNumber: u.unitNumber,
                    jobSite: u.jobSite,
                    status: u.status,
                    model: tel?.model || u.model || "FH16",
                    vin: tel?.vin || null,
                    buntutSummary: trailerSummaryMap[u.unitCode] || "",
                    hasTelemetry: !!tel,
                    liveKm: tel?.km ?? 0,
                    liveHm: tel?.hm ?? 0,
                    fuelLevel: tel?.fuelLevel ?? null,
                    lastTelemetryAt: tel?.lastUpdated ?? null,
                    ...readiness,
                    lastCompletedPm: lastCompleted
                        ? {
                            date: lastCompleted.date,
                            serviceType: lastCompleted.serviceType,
                            currentKm: lastCompleted.currentKm,
                            currentHm: lastCompleted.currentHm,
                            mechanicName: lastCompleted.mechanicName,
                        }
                        : null,
                    activeSchedule: activeSchedule
                        ? {
                            id: activeSchedule.id,
                            date: activeSchedule.date,
                            serviceType: activeSchedule.serviceType,
                            status: activeSchedule.status,
                            shift: activeSchedule.shift,
                        }
                        : null,
                    glSummary: {
                        oilCost: Math.round(glStats.oilCost),
                        greaseCost: Math.round(glStats.greaseCost),
                        sparepartCost: Math.round(glStats.sparepartCost),
                        externalCost: Math.round(glStats.externalCost),
                        totalCost: Math.round(glStats.totalCost),
                        txCount: glStats.txCount,
                        lastServiceDate: glStats.lastServiceDate,
                        lastServiceRemark: glStats.lastServiceRemark,
                    },
                    glHistory: glStats.history,
                };
            });
            const activeUnits = radarUnits.filter((r) => r.status === "Active");
            const summary = {
                totalUnits: radarUnits.length,
                activeUnits: activeUnits.length,
                onlineTelemetry: radarUnits.filter((r) => r.hasTelemetry).length,
                overdueCount: radarUnits.filter((r) => r.readinessStatus === "Overdue").length,
                dueSoonCount: radarUnits.filter((r) => r.readinessStatus === "Due Soon").length,
                safeCount: radarUnits.filter((r) => r.readinessStatus === "Safe").length,
                scheduledCount: radarUnits.filter((r) => !!r.activeSchedule).length,
                totalGlPmCost: radarUnits.reduce((acc, r) => acc + r.glSummary.totalCost, 0),
            };
            return res.json({
                success: true,
                telemetryMeta: {
                    onlineCount: telemetry.onlineCount,
                    fetchedAt: telemetry.fetchedAt,
                    error: telemetry.error || null,
                },
                summary,
                data: radarUnits,
            });
        }
        catch (error) {
            console.error("getPmRadar error:", error);
            return res.status(500).json({ success: false, error: error.message });
        }
    },
    // -------------------------------------------------------------
    // 9. HR PLANT PERSONNEL (SPV PLANT & MECHANICS FOR DROPDOWNS)
    // -------------------------------------------------------------
    getPlantPersonnel: async (req, res) => {
        try {
            const siteParam = String(req.query.site || "MuaraPahu");
            const targetBranch = siteParam === "Senyiur" ? "Senyiur" : "Muara Pahu";
            const rows = await prisma_1.prisma.masterManpower.findMany({
                where: {
                    statusKeaktifan: "Exist",
                    OR: [
                        { organization: { contains: "Plant", mode: "insensitive" } },
                        { jobPosition: { contains: "Mekanik", mode: "insensitive" } },
                        { jobPosition: { contains: "Mechanic", mode: "insensitive" } },
                    ],
                },
                select: {
                    id: true,
                    employeeId: true,
                    fullName: true,
                    jobPosition: true,
                    jobLevel: true,
                    branchName: true,
                },
                orderBy: [{ fullName: "asc" }],
            });
            const rankSiteAndRole = (list, primaryRegex) => [...list].sort((a, b) => {
                const aSite = (a.branchName || "").toLowerCase() === targetBranch.toLowerCase() ? 0 : 1;
                const bSite = (b.branchName || "").toLowerCase() === targetBranch.toLowerCase() ? 0 : 1;
                if (aSite !== bSite)
                    return aSite - bSite;
                const aPri = primaryRegex.test(a.jobPosition || "") ? 0 : 1;
                const bPri = primaryRegex.test(b.jobPosition || "") ? 0 : 1;
                if (aPri !== bPri)
                    return aPri - bPri;
                return a.fullName.localeCompare(b.fullName);
            });
            const supervisors = rankSiteAndRole(rows.filter((r) => /spv|supervisor|superintendent/i.test(r.jobPosition || "")), /^spv\s+plant$/i);
            const mechanics = rankSiteAndRole(rows.filter((r) => /mechanic|mekanik|electrician|welder/i.test(r.jobPosition || "")), /mechanic/i);
            return res.json({
                success: true,
                targetBranch,
                data: { supervisors, mechanics },
            });
        }
        catch (error) {
            console.error("getPlantPersonnel error:", error);
            return res.status(500).json({ success: false, error: error.message });
        }
    },
};
