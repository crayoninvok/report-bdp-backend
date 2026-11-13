import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { JobSite } from "../generated/prisma/client";
import { getVolvoTelemetryMap } from "../lib/volvoClient";
import { isHaulingCategory, resolveHaulingTelemetryCode } from "../lib/volvoUnitSync";
import {
  normalizeHeadCode,
  getWeekRange,
  getDateRange,
  formatIndoDate,
  getIndoDayName,
  getTrailerSummaryMap,
  getSiteUnitPopulations,
  computePmTargets,
} from "../lib/plantHelpers";

const DEFAULT_DAILY_PM_TARGET = 4;

/** Keeps support unit MasterUnit KM/HM synced when a PM entry records newer readings. */
async function syncSupportUnitMeters(
  unit: { unitCode: string; category: string; currentKm: number | null; currentHm: number | null } | null | undefined,
  resolvedKm: number | null | undefined,
  resolvedHm: number | null | undefined
) {
  if (!unit || isHaulingCategory(unit.category)) return;
  const meterPatch: { currentKm?: number; currentHm?: number } = {};
  if (
    resolvedKm != null &&
    Number.isFinite(resolvedKm) &&
    resolvedKm >= 0 &&
    (unit.currentKm == null || resolvedKm > unit.currentKm)
  ) {
    meterPatch.currentKm = resolvedKm;
  }
  if (
    resolvedHm != null &&
    Number.isFinite(resolvedHm) &&
    resolvedHm >= 0 &&
    (unit.currentHm == null || resolvedHm > unit.currentHm)
  ) {
    meterPatch.currentHm = resolvedHm;
  }
  if (Object.keys(meterPatch).length > 0) {
    await prisma.masterUnit.update({
      where: { unitCode: unit.unitCode },
      data: meterPatch,
    });
  }
}

/**
 * Evaluates a single unit's live KM & HM readiness against standard PM intervals
 * (12,000 / 24,000 / 36,000 / 48,000 KM & 250 / 500 / 1,000 / 2,000 HM)
 */
function evaluateUnitPmReadiness(params: {
  liveKm: number;
  liveHm: number;
  hasTelemetry: boolean;
  lastCompletedPm?: {
    date: string;
    serviceType: string;
    currentKm: number | null;
    currentHm: number | null;
    nextDueKm: number | null;
    nextDueHm: number | null;
    mechanicName: string | null;
  } | null;
}) {
  const { liveKm, liveHm, hasTelemetry, lastCompletedPm } = params;

  const cycleKmMilestone =
    liveKm > 0 ? Math.ceil((liveKm + 1) / 12000) * 12000 : 12000;
  const cycleHmMilestone =
    liveHm > 0 ? Math.ceil((liveHm + 1) / 250) * 250 : 250;

  const targetKm =
    lastCompletedPm?.nextDueKm != null && lastCompletedPm.nextDueKm > 0
      ? Math.round(lastCompletedPm.nextDueKm)
      : cycleKmMilestone;

  const targetHm =
    lastCompletedPm?.nextDueHm != null && lastCompletedPm.nextDueHm > 0
      ? Math.round(lastCompletedPm.nextDueHm * 10) / 10
      : cycleHmMilestone;

  const remainingKm = Math.round(targetKm - liveKm);
  const remainingHm = Math.round((targetHm - liveHm) * 10) / 10;

  const getKmLabel = (kmTarget: number) => {
    if (kmTarget > 0 && kmTarget % 48000 === 0) return "PS4 (48.000 KM)";
    if (kmTarget > 0 && kmTarget % 48000 === 36000) return "PS3 (36.000 KM)";
    if (kmTarget > 0 && kmTarget % 48000 === 24000) return "PS2 (24.000 KM)";
    return "PS1 (12.000 KM)";
  };

  const getHmLabel = (hmTarget: number) => {
    const rounded = Math.round(hmTarget);
    if (rounded > 0 && rounded % 2000 === 0) return "P4 (2000 HM)";
    if (rounded > 0 && rounded % 1000 === 0) return "P3 (1000 HM)";
    if (rounded > 0 && rounded % 500 === 0) return "P2 (500 HM)";
    return "P1 (250 HM)";
  };

  const kmServiceLabel = getKmLabel(targetKm);
  const hmServiceLabel = getHmLabel(targetHm);

  let readinessStatus: "Overdue" | "Due Soon" | "Safe" | "No Telemetry" = "Safe";
  if (!hasTelemetry) {
    readinessStatus = "No Telemetry";
  } else if (remainingKm <= 0 || remainingHm <= 0) {
    readinessStatus = "Overdue";
  } else if (remainingKm <= 1500 || remainingHm <= 30) {
    readinessStatus = "Due Soon";
  }

  // Recommend the service tier that is closest or already due
  const recommendedServiceType =
    remainingKm <= 1500
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
function resolveMechanicsPayload(
  mechanicNames?: unknown,
  mechanicName?: unknown,
  inspectorName?: unknown
): { namesArray?: string[]; joinedString?: string | null } {
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
function resolveOptionalBuntutSummary(
  buntutSummary?: unknown,
  includedTrailers?: unknown
): string | null | undefined {
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

/** Parses optional string payload preserving `undefined` for omitted fields and `null` for blanks. */
function parseOptionalTrimmedString(val: unknown): string | null | undefined {
  if (val === undefined) return undefined;
  const trimmed = String(val ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Parses optional float payload supporting comma decimals; returns `null` for blank inputs. */
function parseOptionalFloat(val: unknown): number | null | undefined {
  if (val === undefined) return undefined;
  if (val === null || val === "") return null;
  const normalized = String(val).trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export const pmController = {
  // -------------------------------------------------------------
  // 1. WEEKLY PREVENTIVE MAINTENANCE SCHEDULE
  // -------------------------------------------------------------
  getPmWeeklySchedule: async (req: Request, res: Response) => {
    try {
      const { date, site, startDate: qStartDate, endDate: qEndDate } = req.query;
      const jobSite = (site as JobSite) || "MuaraPahu";

      const { startDate, endDate, dates } =
        qStartDate && qEndDate
          ? getDateRange(qStartDate as string, qEndDate as string)
          : getWeekRange(date as string);

      const globalTargetSetting = await prisma.plantSetting.findUnique({
        where: { key: "daily_pm_target" },
      });
      const defaultDailyTarget = globalTargetSetting
        ? parseInt(globalTargetSetting.value, 10) || DEFAULT_DAILY_PM_TARGET
        : DEFAULT_DAILY_PM_TARGET;

      const [
        { primeMoverPopulation, totalPopulationAllSites },
        existingPlans,
        telemetry,
      ] = await Promise.all([
        getSiteUnitPopulations(jobSite),
        prisma.preventiveMaintenancePlan.findMany({
          where: { jobSite, date: { in: dates } },
          include: {
            items: {
              include: { unit: true },
              orderBy: [{ shift: "asc" }, { unitCode: "asc" }],
            },
          },
        }),
        getVolvoTelemetryMap(),
      ]);

      const planByDate: Record<string, any> = {};
      for (const p of existingPlans) {
        planByDate[p.date] = p;
      }

      let totalWeekPlan = 0;
      let totalWeekScheduled = 0;
      let totalWeekCompleted = 0;
      const todayStr = new Date().toISOString().slice(0, 10);

      const days = dates.map((dStr) => {
        const plan = planByDate[dStr];
        const targetUnits =
          plan && plan.targetUnits !== undefined ? plan.targetUnits : defaultDailyTarget;

        const items = (plan?.items || []).map((item: any) => {
          const telCode = item.unit
            ? resolveHaulingTelemetryCode(item.unit)
            : item.unitCode;
          const tel = telCode ? telemetry.map.get(telCode) : undefined;
          return {
            ...item,
            inspectorName: item.mechanicName || null,
            liveKm: tel?.km ?? null,
            liveHm: tel?.hm ?? null,
            buntutSummary: item.buntutSummary || "",
          };
        });

        const scheduledCount = items.length;
        const completedCount = items.filter((it: any) => it.status === "Completed").length;
        const inProgressCount = items.filter((it: any) => it.status === "In Progress").length;

        totalWeekPlan += targetUnits;
        totalWeekScheduled += scheduledCount;
        totalWeekCompleted += completedCount;

        return {
          date: dStr,
          dayName: getIndoDayName(dStr),
          dayDateFormatted: formatIndoDate(dStr),
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

      const scheduledPercent =
        totalWeekPlan > 0 ? Math.round((totalWeekScheduled / totalWeekPlan) * 100) : 0;
      const achievementPercent =
        totalWeekPlan > 0 ? Math.round((totalWeekCompleted / totalWeekPlan) * 100) : 0;

      return res.json({
        success: true,
        data: {
          weekRange: {
            startDate,
            endDate,
            formatted: `${formatIndoDate(startDate)} - ${formatIndoDate(endDate)}`,
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
    } catch (error: any) {
      console.error("getPmWeeklySchedule error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 2. DAILY PLAN TARGET & LEAD MECHANIC UPDATE
  // -------------------------------------------------------------
  upsertPmDailyPlan: async (req: Request, res: Response) => {
    try {
      const {
        date,
        targetUnits,
        notes,
        leadMechanic,
        leadInspector,
        jobSite = "MuaraPahu",
      } = req.body;

      if (!date) {
        return res
          .status(400)
          .json({ success: false, message: "Tanggal (date) wajib diisi" });
      }

      let numTarget: number | undefined = undefined;
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

      const plan = await prisma.preventiveMaintenancePlan.upsert({
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
        message: `Plan Periodic Service tanggal ${formatIndoDate(date)} berhasil diperbarui`,
        data: plan,
      });
    } catch (error: any) {
      console.error("upsertPmDailyPlan error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 3. ADD / SCHEDULE UNIT FOR PERIODIC SERVICE
  // -------------------------------------------------------------
  addPmItem: async (req: Request, res: Response) => {
    try {
      const {
        date,
        unitCode,
        serviceType = "PS1 (12.000 KM)",
        shift = "Shift 1",
        status = "Scheduled",
        category = "Scheduled PS",
        planStartTime,
        planLeadTime,
        planHmServis,
        actualStartTime,
        actualLeadTime,
        actualHmServis,
        supervisorName,
        mechanicNames,
        mechanicName,
        inspectorName,
        buntutSummary: rawBuntutSummary,
        includedTrailers,
        currentKm,
        currentHm,
        nextDueKm,
        nextDueHm,
        notes,
        jobSite = "MuaraPahu",
      } = req.body;

      if (!date || !unitCode) {
        return res.status(400).json({
          success: false,
          message: "Tanggal dan Kode Unit wajib diisi",
        });
      }

      const normalizedUnitCode = normalizeHeadCode(unitCode);

      const [masterUnit, globalTargetSetting, telemetry] = await Promise.all([
        prisma.masterUnit.findUnique({ where: { unitCode: normalizedUnitCode } }),
        prisma.plantSetting.findUnique({ where: { key: "daily_pm_target" } }),
        getVolvoTelemetryMap(),
      ]);

      const isHead = !masterUnit || masterUnit.category === "Prime Mover";
      const resolvedBuntut = isHead
        ? resolveOptionalBuntutSummary(rawBuntutSummary, includedTrailers)
        : null;
      const defaultTarget = globalTargetSetting
        ? parseInt(globalTargetSetting.value, 10) || DEFAULT_DAILY_PM_TARGET
        : DEFAULT_DAILY_PM_TARGET;

      const telCode = masterUnit
        ? resolveHaulingTelemetryCode(masterUnit)
        : normalizedUnitCode;
      const tel = telCode ? telemetry.map.get(telCode) : undefined;
      const isSupport = Boolean(masterUnit && !isHaulingCategory(masterUnit.category));
      const resolvedKm =
        currentKm !== undefined && currentKm !== null && currentKm !== ""
          ? Number(currentKm)
          : tel?.km ?? (isSupport ? masterUnit?.currentKm ?? null : null);
      const resolvedHm =
        currentHm !== undefined && currentHm !== null && currentHm !== ""
          ? Number(currentHm)
          : tel?.hm ?? (isSupport ? masterUnit?.currentHm ?? null : null);

      const autoTargets = computePmTargets(serviceType, resolvedKm, resolvedHm);
      const resolvedNextKm =
        nextDueKm !== undefined && nextDueKm !== null && nextDueKm !== ""
          ? Number(nextDueKm)
          : autoTargets.nextDueKm;
      const resolvedNextHm =
        nextDueHm !== undefined && nextDueHm !== null && nextDueHm !== ""
          ? Number(nextDueHm)
          : autoTargets.nextDueHm;

      const mechResolved = resolveMechanicsPayload(
        mechanicNames,
        mechanicName,
        inspectorName
      );

      const plan = await prisma.preventiveMaintenancePlan.upsert({
        where: { jobSite_date: { jobSite, date } },
        update: {},
        create: { jobSite, date, targetUnits: defaultTarget },
      });

      const parsedActualStart = parseOptionalTrimmedString(actualStartTime);
      const parsedActualLead = parseOptionalTrimmedString(actualLeadTime);
      const parsedActualHm = parseOptionalFloat(actualHmServis);

      const item = await prisma.preventiveMaintenanceItem.upsert({
        where: { planId_unitCode: { planId: plan.id, unitCode: normalizedUnitCode } },
        update: {
          serviceType,
          shift,
          status,
          category: category || "Scheduled PS",
          planStartTime: planStartTime !== undefined ? planStartTime || null : undefined,
          planLeadTime: planLeadTime !== undefined ? planLeadTime || null : undefined,
          planHmServis: planHmServis !== undefined ? planHmServis || null : undefined,
          ...(parsedActualStart !== undefined ? { actualStartTime: parsedActualStart } : {}),
          ...(parsedActualLead !== undefined ? { actualLeadTime: parsedActualLead } : {}),
          ...(parsedActualHm !== undefined ? { actualHmServis: parsedActualHm } : {}),
          supervisorName:
            supervisorName !== undefined ? supervisorName || null : undefined,
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
          actualStartTime: parsedActualStart ?? null,
          actualLeadTime: parsedActualLead ?? null,
          actualHmServis: parsedActualHm ?? null,
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

      await syncSupportUnitMeters(masterUnit, resolvedKm, resolvedHm);

      return res.json({
        success: true,
        message: `Unit ${normalizedUnitCode} berhasil dijadwalkan Periodic Service untuk ${formatIndoDate(date)}`,
        data: {
          ...item,
          buntutSummary: item.buntutSummary || "",
          inspectorName: item.mechanicName || null,
          liveKm: tel?.km ?? null,
          liveHm: tel?.hm ?? null,
        },
      });
    } catch (error: any) {
      console.error("addPmItem error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 4. BULK ADD UNITS FOR PM
  // -------------------------------------------------------------
  bulkAddPmItems: async (req: Request, res: Response) => {
    try {
      const {
        date,
        unitCodes,
        serviceType = "PS1 (12.000 KM)",
        shift = "Shift 1",
        jobSite = "MuaraPahu",
      } = req.body;

      if (!date || !Array.isArray(unitCodes) || unitCodes.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Tanggal dan daftar kode unit wajib diisi",
        });
      }

      const normalizedCodes = unitCodes.map((rawCode: string) =>
        normalizeHeadCode(rawCode)
      );

      const [matchedUnits, globalTargetSetting, telemetry] = await Promise.all([
        prisma.masterUnit.findMany({
          where: { unitCode: { in: normalizedCodes } },
          select: { unitCode: true, category: true, headUnitCode: true },
        }),
        prisma.plantSetting.findUnique({ where: { key: "daily_pm_target" } }),
        getVolvoTelemetryMap(),
      ]);

      const unitMetaMap = new Map(
        matchedUnits.map((u) => [u.unitCode, u])
      );
      const defaultTarget = globalTargetSetting
        ? parseInt(globalTargetSetting.value, 10) || DEFAULT_DAILY_PM_TARGET
        : DEFAULT_DAILY_PM_TARGET;

      const plan = await prisma.preventiveMaintenancePlan.upsert({
        where: { jobSite_date: { jobSite, date } },
        update: {},
        create: { jobSite, date, targetUnits: defaultTarget },
      });

      const results = [];
      for (const code of normalizedCodes) {
        const unitMeta = unitMetaMap.get(code);
        const telCode = unitMeta ? resolveHaulingTelemetryCode(unitMeta) : code;
        const tel = telCode ? telemetry.map.get(telCode) : undefined;
        const currentKm = tel?.km ?? null;
        const currentHm = tel?.hm ?? null;
        const { nextDueKm, nextDueHm } = computePmTargets(
          serviceType,
          currentKm,
          currentHm
        );

        const item = await prisma.preventiveMaintenanceItem.upsert({
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
        message: `${results.length} unit berhasil dijadwalkan Periodic Service untuk ${formatIndoDate(date)}`,
        data: results,
      });
    } catch (error: any) {
      console.error("bulkAddPmItems error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 5. UPDATE PERIODIC SERVICE ITEM
  // -------------------------------------------------------------
  updatePmItem: async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const {
        serviceType,
        shift,
        status,
        category,
        planStartTime,
        planLeadTime,
        planHmServis,
        actualStartTime,
        actualLeadTime,
        actualHmServis,
        supervisorName,
        mechanicNames,
        mechanicName,
        inspectorName,
        buntutSummary: rawBuntutSummary,
        includedTrailers,
        currentKm,
        currentHm,
        nextDueKm,
        nextDueHm,
        notes,
      } = req.body;

      const existing = await prisma.preventiveMaintenanceItem.findUnique({
        where: { id },
        include: { unit: true },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Jadwal Periodic Service tidak ditemukan" });
      }

      const isHead = !existing.unit || existing.unit.category === "Prime Mover";
      const mechResolved = resolveMechanicsPayload(
        mechanicNames,
        mechanicName,
        inspectorName
      );
      const resolvedBuntut = isHead
        ? resolveOptionalBuntutSummary(rawBuntutSummary, includedTrailers)
        : null;
      const effectiveService = serviceType || existing.serviceType;

      let resolvedKm =
        currentKm !== undefined ? (currentKm === null || currentKm === "" ? null : Number(currentKm)) : existing.currentKm;
      let resolvedHm =
        currentHm !== undefined ? (currentHm === null || currentHm === "" ? null : Number(currentHm)) : existing.currentHm;

      // On completion of a Prime Mover or paired Vessel/Dolly, capture live Volvo KM/HM if still missing
      const telCode = existing.unit
        ? resolveHaulingTelemetryCode(existing.unit)
        : existing.unitCode;
      if (telCode && status === "Completed" && (resolvedKm == null || resolvedHm == null)) {
        const telemetry = await getVolvoTelemetryMap();
        const tel = telemetry.map.get(telCode);
        if (tel) {
          if (resolvedKm == null) resolvedKm = tel.km;
          if (resolvedHm == null) resolvedHm = tel.hm;
        }
      }

      const computed = computePmTargets(effectiveService, resolvedKm, resolvedHm);
      const resolvedNextKm =
        nextDueKm !== undefined
          ? nextDueKm === null || nextDueKm === ""
            ? null
            : Number(nextDueKm)
          : status === "Completed" && computed.nextDueKm != null
          ? computed.nextDueKm
          : existing.nextDueKm;
      const resolvedNextHm =
        nextDueHm !== undefined
          ? nextDueHm === null || nextDueHm === ""
            ? null
            : Number(nextDueHm)
          : status === "Completed" && computed.nextDueHm != null
          ? computed.nextDueHm
          : existing.nextDueHm;

      const parsedActualStart = parseOptionalTrimmedString(actualStartTime);
      const parsedActualLead = parseOptionalTrimmedString(actualLeadTime);
      const parsedActualHm = parseOptionalFloat(actualHmServis);

      const updated = await prisma.preventiveMaintenanceItem.update({
        where: { id },
        data: {
          serviceType: serviceType || undefined,
          shift: shift || undefined,
          status: status || undefined,
          category: category !== undefined ? category || "Scheduled PS" : undefined,
          planStartTime: planStartTime !== undefined ? planStartTime || null : undefined,
          planLeadTime: planLeadTime !== undefined ? planLeadTime || null : undefined,
          planHmServis: planHmServis !== undefined ? planHmServis || null : undefined,
          ...(parsedActualStart !== undefined ? { actualStartTime: parsedActualStart } : {}),
          ...(parsedActualLead !== undefined ? { actualLeadTime: parsedActualLead } : {}),
          ...(parsedActualHm !== undefined ? { actualHmServis: parsedActualHm } : {}),
          supervisorName:
            supervisorName !== undefined ? supervisorName || null : undefined,
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

      await syncSupportUnitMeters(existing.unit, resolvedKm, resolvedHm);

      return res.json({
        success: true,
        message: "Jadwal Periodic Service berhasil diperbarui",
        data: {
          ...updated,
          buntutSummary: updated.buntutSummary || "",
          inspectorName: updated.mechanicName || null,
        },
      });
    } catch (error: any) {
      console.error("updatePmItem error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 6. DELETE PERIODIC SERVICE ITEM
  // -------------------------------------------------------------
  deletePmItem: async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const existing = await prisma.preventiveMaintenanceItem.findUnique({ where: { id } });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Jadwal Periodic Service tidak ditemukan" });
      }

      await prisma.preventiveMaintenanceItem.delete({ where: { id } });
      return res.json({
        success: true,
        message: `Unit ${existing.unitCode} dihapus dari jadwal Periodic Service`,
      });
    } catch (error: any) {
      console.error("deletePmItem error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 7. AUTO-SCHEDULE DUE / OVERDUE UNITS FOR CURRENT WEEK
  // -------------------------------------------------------------
  autoScheduleDueUnits: async (req: Request, res: Response) => {
    try {
      const { date, jobSite = "MuaraPahu" } = req.body;
      const { startDate, endDate, dates } = getWeekRange(date);

      const [units, telemetry, existingPlans, globalTargetSetting, completedItems] =
        await Promise.all([
          prisma.masterUnit.findMany({
            where: { category: "Prime Mover", status: "Active", jobSite },
            orderBy: { unitNumber: "asc" },
          }),
          getVolvoTelemetryMap(),
          prisma.preventiveMaintenancePlan.findMany({
            where: { jobSite, date: { in: dates } },
            include: { items: true },
          }),
          prisma.plantSetting.findUnique({ where: { key: "daily_pm_target" } }),
          prisma.preventiveMaintenanceItem.findMany({
            where: { status: "Completed" },
            orderBy: { date: "desc" },
          }),
        ]);

      const dailyTarget = globalTargetSetting
        ? parseInt(globalTargetSetting.value, 10) || DEFAULT_DAILY_PM_TARGET
        : DEFAULT_DAILY_PM_TARGET;

      const scheduledInWeek = new Set<string>();
      const countByDate = new Map<string, number>();
      for (const d of dates) countByDate.set(d, 0);

      for (const p of existingPlans) {
        countByDate.set(p.date, p.items.length);
        for (const it of p.items) scheduledInWeek.add(it.unitCode);
      }

      const lastCompletedByUnit = new Map<string, any>();
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
        .filter(
          (x) =>
            x.evalRes.readinessStatus === "Overdue" ||
            x.evalRes.readinessStatus === "Due Soon"
        )
        .sort((a, b) => a.evalRes.remainingKm - b.evalRes.remainingKm);

      if (dueUnits.length === 0) {
        return res.json({
          success: true,
          scheduledCount: 0,
          message: `Semua unit yang mendekati jadwal PM (<= 1.500 KM / <= 30 HM) di ${jobSite} sudah terjadwal di minggu ${formatIndoDate(startDate)} s/d ${formatIndoDate(endDate)}.`,
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

        const plan = await prisma.preventiveMaintenancePlan.upsert({
          where: { jobSite_date: { jobSite, date: chosenDate } },
          update: {},
          create: { jobSite, date: chosenDate, targetUnits: dailyTarget },
        });

        await prisma.preventiveMaintenanceItem.upsert({
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
        message: `${inserted} unit Overdue/Due Soon berhasil dijadwalkan otomatis pada minggu ${formatIndoDate(startDate)} s/d ${formatIndoDate(endDate)}.`,
      });
    } catch (error: any) {
      console.error("autoScheduleDueUnits error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 8. PM READINESS RADAR PER UNIT (LIVE VOLVO KM/HM)
  // -------------------------------------------------------------
  getPmRadar: async (req: Request, res: Response) => {
    try {
      const siteParam = req.query.site ? String(req.query.site) : "ALL";
      const forceRefresh = req.query.force === "true";

      const unitWhere: any = { category: "Prime Mover" };
      if (siteParam && siteParam !== "ALL") {
        unitWhere.jobSite = siteParam as JobSite;
      }

      const [
        primeMovers,
        trailerSummaryMap,
        telemetry,
        allPmItems,
      ] = await Promise.all([
        prisma.masterUnit.findMany({
          where: unitWhere,
          orderBy: { unitNumber: "asc" },
        }),
        getTrailerSummaryMap(),
        getVolvoTelemetryMap(forceRefresh),
        prisma.preventiveMaintenanceItem.findMany({
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        }),
      ]);

      // Group PM items by unitCode
      const lastCompletedByUnit = new Map<string, any>();
      const activeScheduleByUnit = new Map<string, any>();
      for (const item of allPmItems) {
        if (item.status === "Completed" && !lastCompletedByUnit.has(item.unitCode)) {
          lastCompletedByUnit.set(item.unitCode, item);
        }
        if (
          (item.status === "Scheduled" || item.status === "In Progress") &&
          !activeScheduleByUnit.has(item.unitCode)
        ) {
          activeScheduleByUnit.set(item.unitCode, item);
        }
      }

      // Build unified Radar rows
      const radarUnits = primeMovers.map((u) => {
        const tel = telemetry.map.get(u.unitCode);
        const lastCompleted = lastCompletedByUnit.get(u.unitCode) || null;
        const activeSchedule = activeScheduleByUnit.get(u.unitCode) || null;

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
    } catch (error: any) {
      console.error("getPmRadar error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 9. HR PLANT PERSONNEL (SPV PLANT & MECHANICS FOR DROPDOWNS)
  // -------------------------------------------------------------
  getPlantPersonnel: async (req: Request, res: Response) => {
    try {
      const siteParam = String(req.query.site || "MuaraPahu");
      const targetBranch = siteParam === "Senyiur" ? "Senyiur" : "Muara Pahu";

      const rows = await prisma.masterManpower.findMany({
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

      const rankSiteAndRole = <
        T extends { branchName: string | null; jobPosition: string | null; fullName: string }
      >(
        list: T[],
        primaryRegex: RegExp
      ) =>
        [...list].sort((a, b) => {
          const aSite = (a.branchName || "").toLowerCase() === targetBranch.toLowerCase() ? 0 : 1;
          const bSite = (b.branchName || "").toLowerCase() === targetBranch.toLowerCase() ? 0 : 1;
          if (aSite !== bSite) return aSite - bSite;
          const aPri = primaryRegex.test(a.jobPosition || "") ? 0 : 1;
          const bPri = primaryRegex.test(b.jobPosition || "") ? 0 : 1;
          if (aPri !== bPri) return aPri - bPri;
          return a.fullName.localeCompare(b.fullName);
        });

      const supervisors = rankSiteAndRole(
        rows.filter((r) => /spv|supervisor|superintendent/i.test(r.jobPosition || "")),
        /^spv\s+plant$/i
      );

      const mechanics = rankSiteAndRole(
        rows.filter((r) =>
          /mechanic|mekanik|electrician|welder/i.test(r.jobPosition || "")
        ),
        /mechanic/i
      );

      return res.json({
        success: true,
        targetBranch,
        data: { supervisors, mechanics },
      });
    } catch (error: any) {
      console.error("getPlantPersonnel error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },
};

