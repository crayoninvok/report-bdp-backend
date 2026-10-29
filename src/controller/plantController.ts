import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { JobSite } from "../generated/prisma/client";

/**
 * Normalizes input unit code to Prime Mover code
 * e.g. "401" -> "PM401", "pm401" -> "PM401", "PM401" -> "PM401"
 */
function normalizeHeadCode(input: string): string {
  const clean = input.trim().toUpperCase();
  if (/^\d{3}$/.test(clean)) {
    return `PM${clean}`;
  }
  return clean;
}

/**
 * Helper to get Monday and Sunday dates of a given date (or current date)
 */
function getWeekRange(dateInput?: string): {
  startDate: string;
  endDate: string;
  dates: string[];
} {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    return getWeekRange();
  }

  // Adjust to Monday (1) through Sunday (7)
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day; // If Sunday, day=0 -> diff=-6
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
 * Helper to generate date range from startDate to endDate (supports multi-week / fixed date ranges up to 90 days)
 */
function getDateRange(startDateStr: string, endDateStr: string): {
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

const INDO_DAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

const INDO_MONTHS = [
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

function formatIndoDate(dateStr: string): string {
  try {
    const parts = dateStr.split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return `${d} ${INDO_MONTHS[m]} ${y}`;
  } catch {
    return dateStr;
  }
}

function getIndoDayName(dateStr: string): string {
  try {
    const parts = dateStr.split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m, d);
    return INDO_DAYS[dt.getDay()];
  } catch {
    return "";
  }
}

export const plantController = {
  // -------------------------------------------------------------
  // 1. MASTER UNITS
  // -------------------------------------------------------------
  getMasterUnits: async (req: Request, res: Response) => {
    try {
      const { category, search, withTrailers, site } = req.query;

      const where: any = {};
      if (category && typeof category === "string" && category !== "ALL") {
        where.category = category;
      }
      if (site && typeof site === "string" && site !== "ALL") {
        where.jobSite = site as JobSite;
      }
      if (search && typeof search === "string" && search.trim()) {
        const q = search.trim();
        where.OR = [
          { unitCode: { contains: q, mode: "insensitive" } },
          { headUnitCode: { contains: q, mode: "insensitive" } },
          { model: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
        ];
      }

      const units = await prisma.masterUnit.findMany({
        where,
        orderBy: [{ category: "asc" }, { unitNumber: "asc" }],
      });

      // If requested or if fetching prime movers, attach trailer sets
      let enrichedUnits: any[] = units;
      if (withTrailers === "true" || category === "Prime Mover") {
        // Fetch all trailer units
        const allTrailers = await prisma.masterUnit.findMany({
          where: { category: { not: "Prime Mover" } },
          orderBy: { unitNumber: "asc" },
        });

        const trailerMap: Record<
          string,
          { vessel1?: any; dolly?: any; vessel2?: any; summary: string }
        > = {};

        for (const t of allTrailers) {
          if (!t.headUnitCode) continue;
          if (!trailerMap[t.headUnitCode]) {
            trailerMap[t.headUnitCode] = { summary: "" };
          }
          if (t.category === "Vessel 1") trailerMap[t.headUnitCode].vessel1 = t;
          if (t.category === "Dolly") trailerMap[t.headUnitCode].dolly = t;
          if (t.category === "Vessel 2") trailerMap[t.headUnitCode].vessel2 = t;
        }

        for (const head in trailerMap) {
          const parts: string[] = [];
          if (trailerMap[head].vessel1) parts.push(trailerMap[head].vessel1.unitCode);
          if (trailerMap[head].dolly) parts.push(trailerMap[head].dolly.unitCode);
          if (trailerMap[head].vessel2) parts.push(trailerMap[head].vessel2.unitCode);
          trailerMap[head].summary = parts.join(", ");
        }

        enrichedUnits = units.map((u) => {
          if (u.category === "Prime Mover") {
            const trailers = trailerMap[u.unitCode] || { summary: "" };
            return {
              ...u,
              trailers,
              buntutSummary: trailers.summary,
            };
          }
          return u;
        });
      }

      // Summary counts
      const counts = await prisma.masterUnit.groupBy({
        by: ["category"],
        _count: { id: true },
      });

      const summaryCounts: Record<string, number> = {
        total: 0,
        primeMover: 0,
        vessel1: 0,
        dolly: 0,
        vessel2: 0,
      };

      for (const c of counts) {
        summaryCounts.total += c._count.id;
        if (c.category === "Prime Mover") summaryCounts.primeMover = c._count.id;
        if (c.category === "Vessel 1") summaryCounts.vessel1 = c._count.id;
        if (c.category === "Dolly") summaryCounts.dolly = c._count.id;
        if (c.category === "Vessel 2") summaryCounts.vessel2 = c._count.id;
      }

      return res.json({
        success: true,
        data: enrichedUnits,
        summary: summaryCounts,
      });
    } catch (error: any) {
      console.error("getMasterUnits error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  updateUnit: async (req: Request, res: Response) => {
    try {
      const userRole = req.headers["x-user-role"];
      if (userRole !== "SuperAdmin") {
        return res.status(403).json({
          success: false,
          message: "Hanya Super Admin yang berwenang mengubah status atau jobsite unit.",
        });
      }

      const unitCode = String(req.params.unitCode).toUpperCase();
      const { status, jobSite } = req.body;

      const unit = await prisma.masterUnit.findUnique({
        where: { unitCode },
      });
      if (!unit) {
        return res.status(404).json({ success: false, message: "Unit tidak ditemukan" });
      }

      const updateData: any = {};
      if (status && (status === "Active" || status === "Inactive")) {
        updateData.status = status;
      }
      if (jobSite && (jobSite === "MuaraPahu" || jobSite === "Senyiur")) {
        updateData.jobSite = jobSite as JobSite;
      }

      // If unit is Prime Mover (kepala), cascade jobsite and status to all its trailers/buntut
      if (unit.category === "Prime Mover") {
        await prisma.masterUnit.updateMany({
          where: { headUnitCode: unitCode },
          data: updateData,
        });
      } else {
        await prisma.masterUnit.update({
          where: { unitCode },
          data: updateData,
        });
      }

      const updated = await prisma.masterUnit.findUnique({
        where: { unitCode },
      });

      return res.json({
        success: true,
        message:
          unit.category === "Prime Mover"
            ? `Unit kepala ${unitCode} beserta seluruh rangkaian buntutnya berhasil diperbarui (${updateData.jobSite ? `Site: ${updateData.jobSite}` : ""} ${updateData.status ? `Status: ${updateData.status}` : ""}).`
            : `Unit ${unitCode} berhasil diperbarui.`,
        data: updated,
      });
    } catch (error: any) {
      console.error("updateUnit error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 2. PLANT SETTINGS (Daily Target)
  // -------------------------------------------------------------
  getPlantSettings: async (req: Request, res: Response) => {
    try {
      const settings = await prisma.plantSetting.findMany();
      const settingsMap: Record<string, string> = {
        daily_pi_target: "9",
      };
      for (const s of settings) {
        settingsMap[s.key] = s.value;
      }

      return res.json({
        success: true,
        data: settingsMap,
      });
    } catch (error: any) {
      console.error("getPlantSettings error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  updatePlantSetting: async (req: Request, res: Response) => {
    try {
      const { key, value, description } = req.body;
      if (!key || value === undefined) {
        return res
          .status(400)
          .json({ success: false, message: "Key dan Value wajib diisi" });
      }

      const updated = await prisma.plantSetting.upsert({
        where: { key },
        update: {
          value: String(value),
          description: description || undefined,
        },
        create: {
          key,
          value: String(value),
          description: description || undefined,
          jobSite: "MuaraPahu",
        },
      });

      return res.json({
        success: true,
        message: `Pengaturan '${key}' berhasil diperbarui ke '${value}'`,
        data: updated,
      });
    } catch (error: any) {
      console.error("updatePlantSetting error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 3. WEEKLY PERIODIC INSPECTION SCHEDULE
  // -------------------------------------------------------------
  getWeeklySchedule: async (req: Request, res: Response) => {
    try {
      const { date, site, startDate: qStartDate, endDate: qEndDate } = req.query;
      const jobSite = (site as JobSite) || "MuaraPahu";

      // Calculate date range: if specific startDate & endDate are given, use them; otherwise use week of `date`
      const { startDate, endDate, dates } =
        qStartDate && qEndDate
          ? getDateRange(qStartDate as string, qEndDate as string)
          : getWeekRange(date as string);

      // Get global default daily target
      const globalTargetSetting = await prisma.plantSetting.findUnique({
        where: { key: "daily_pi_target" },
      });
      const defaultDailyTarget = globalTargetSetting
        ? parseInt(globalTargetSetting.value, 10) || 9
        : 9;

      // Fetch active Prime Mover count (unit population) for this jobsite
      const primeMoverPopulation = await prisma.masterUnit.count({
        where: { category: "Prime Mover", status: "Active", jobSite },
      });
      const totalPopulationAllSites = await prisma.masterUnit.count({
        where: { category: "Prime Mover", status: "Active" },
      });

      // Fetch all plans in this date range
      const existingPlans = await prisma.periodicInspectionPlan.findMany({
        where: {
          jobSite,
          date: { in: dates },
        },
        include: {
          items: {
            include: {
              unit: true,
            },
            orderBy: [{ shift: "asc" }, { unitCode: "asc" }],
          },
        },
      });

      const planByDate: Record<string, any> = {};
      for (const p of existingPlans) {
        planByDate[p.date] = p;
      }

      // Pre-fetch trailers map for automatic trailer buntut display
      const allTrailers = await prisma.masterUnit.findMany({
        where: { category: { not: "Prime Mover" } },
        orderBy: { unitNumber: "asc" },
      });
      const trailerSummaryMap: Record<string, string> = {};
      for (const t of allTrailers) {
        if (!t.headUnitCode) continue;
        if (!trailerSummaryMap[t.headUnitCode]) {
          trailerSummaryMap[t.headUnitCode] = "";
        }
        const curr = trailerSummaryMap[t.headUnitCode];
        trailerSummaryMap[t.headUnitCode] = curr
          ? `${curr}, ${t.unitCode}`
          : t.unitCode;
      }

      // Build structured response for each of the 7 days
      let totalWeekPlan = 0;
      let totalWeekScheduled = 0;
      let totalWeekCompleted = 0;

      const todayStr = new Date().toISOString().slice(0, 10);

      const days = dates.map((dStr) => {
        const plan = planByDate[dStr];
        const targetUnits =
          plan && plan.targetUnits !== undefined
            ? plan.targetUnits
            : defaultDailyTarget;
        const items = (plan?.items || []).map((item: any) => ({
          ...item,
          buntutSummary:
            item.buntutSummary || trailerSummaryMap[item.unitCode] || "",
        }));

        const scheduledCount = items.length;
        const completedCount = items.filter(
          (it: any) => it.status === "Completed"
        ).length;
        const inProgressCount = items.filter(
          (it: any) => it.status === "In Progress"
        ).length;

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
          scheduledCount,
          completedCount,
          inProgressCount,
          isTargetAchieved: completedCount >= targetUnits && targetUnits > 0,
          notes: plan?.notes || null,
          items,
        };
      });

      const scheduledPercent =
        totalWeekPlan > 0
          ? Math.round((totalWeekScheduled / totalWeekPlan) * 100)
          : 0;
      const achievementPercent =
        totalWeekPlan > 0
          ? Math.round((totalWeekCompleted / totalWeekPlan) * 100)
          : 0;

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
      console.error("getWeeklySchedule error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 4. DAILY PLAN TARGET UPDATE
  // -------------------------------------------------------------
  upsertDailyPlan: async (req: Request, res: Response) => {
    try {
      const { date, targetUnits, notes, jobSite = "MuaraPahu" } = req.body;
      if (!date) {
        return res
          .status(400)
          .json({ success: false, message: "Tanggal (date) wajib diisi" });
      }

      const numTarget = parseInt(targetUnits, 10);
      if (isNaN(numTarget) || numTarget < 0) {
        return res
          .status(400)
          .json({ success: false, message: "Target units harus angka valid >= 0" });
      }

      const plan = await prisma.periodicInspectionPlan.upsert({
        where: {
          jobSite_date: {
            jobSite,
            date,
          },
        },
        update: {
          targetUnits: numTarget,
          notes: notes !== undefined ? notes : undefined,
        },
        create: {
          jobSite,
          date,
          targetUnits: numTarget,
          notes: notes || null,
        },
      });

      return res.json({
        success: true,
        message: `Plan target tanggal ${formatIndoDate(date)} diperbarui ke ${numTarget} unit`,
        data: plan,
      });
    } catch (error: any) {
      console.error("upsertDailyPlan error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 5. ADD / SCHEDULE UNIT FOR PI
  // -------------------------------------------------------------
  addInspectionItem: async (req: Request, res: Response) => {
    try {
      const {
        date,
        unitCode,
        serviceType = "PI Regular",
        shift = "Shift 1",
        status = "Scheduled",
        inspectorName,
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

      // Verify that this unit exists in MasterUnit (Kepala)
      const headUnit = await prisma.masterUnit.findUnique({
        where: { unitCode: normalizedUnitCode },
      });

      // Find trailer buntut for this head
      const trailers = await prisma.masterUnit.findMany({
        where: { headUnitCode: normalizedUnitCode, category: { not: "Prime Mover" } },
        orderBy: { unitNumber: "asc" },
      });
      const buntutSummary = trailers.map((t) => t.unitCode).join(", ");

      // Ensure Daily Plan exists for this date
      const globalTargetSetting = await prisma.plantSetting.findUnique({
        where: { key: "daily_pi_target" },
      });
      const defaultTarget = globalTargetSetting
        ? parseInt(globalTargetSetting.value, 10) || 9
        : 9;

      const plan = await prisma.periodicInspectionPlan.upsert({
        where: {
          jobSite_date: {
            jobSite,
            date,
          },
        },
        update: {},
        create: {
          jobSite,
          date,
          targetUnits: defaultTarget,
        },
      });

      // Create or upsert inspection item
      const item = await prisma.periodicInspectionItem.upsert({
        where: {
          planId_unitCode: {
            planId: plan.id,
            unitCode: normalizedUnitCode,
          },
        },
        update: {
          serviceType,
          shift,
          status,
          inspectorName: inspectorName || undefined,
          notes: notes !== undefined ? notes : undefined,
          buntutSummary: buntutSummary || undefined,
        },
        create: {
          planId: plan.id,
          date,
          unitCode: normalizedUnitCode,
          serviceType,
          shift,
          status,
          inspectorName: inspectorName || null,
          notes: notes || null,
          buntutSummary: buntutSummary || null,
        },
        include: {
          unit: true,
        },
      });

      return res.json({
        success: true,
        message: `Unit ${normalizedUnitCode} berhasil dijadwalkan untuk ${formatIndoDate(date)}`,
        data: item,
      });
    } catch (error: any) {
      console.error("addInspectionItem error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 6. BULK ADD UNITS FOR A DAY
  // -------------------------------------------------------------
  bulkAddInspectionItems: async (req: Request, res: Response) => {
    try {
      const {
        date,
        unitCodes,
        serviceType = "PI Regular",
        shift = "Shift 1",
        jobSite = "MuaraPahu",
      } = req.body;

      if (!date || !Array.isArray(unitCodes) || unitCodes.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Tanggal dan daftar kode unit wajib diisi",
        });
      }

      // Ensure Daily Plan exists
      const globalTargetSetting = await prisma.plantSetting.findUnique({
        where: { key: "daily_pi_target" },
      });
      const defaultTarget = globalTargetSetting
        ? parseInt(globalTargetSetting.value, 10) || 9
        : 9;

      const plan = await prisma.periodicInspectionPlan.upsert({
        where: {
          jobSite_date: {
            jobSite,
            date,
          },
        },
        update: {},
        create: {
          jobSite,
          date,
          targetUnits: defaultTarget,
        },
      });

      // Preload all trailers
      const allTrailers = await prisma.masterUnit.findMany({
        where: { category: { not: "Prime Mover" } },
      });
      const trailerSummaryMap: Record<string, string> = {};
      for (const t of allTrailers) {
        if (!t.headUnitCode) continue;
        const curr = trailerSummaryMap[t.headUnitCode];
        trailerSummaryMap[t.headUnitCode] = curr
          ? `${curr}, ${t.unitCode}`
          : t.unitCode;
      }

      const results = [];
      for (const rawCode of unitCodes) {
        const code = normalizeHeadCode(rawCode);
        const buntutSummary = trailerSummaryMap[code] || null;

        const item = await prisma.periodicInspectionItem.upsert({
          where: {
            planId_unitCode: {
              planId: plan.id,
              unitCode: code,
            },
          },
          update: {
            serviceType,
            shift,
            buntutSummary: buntutSummary || undefined,
          },
          create: {
            planId: plan.id,
            date,
            unitCode: code,
            serviceType,
            shift,
            status: "Scheduled",
            buntutSummary,
          },
        });
        results.push(item);
      }

      return res.json({
        success: true,
        message: `${results.length} unit berhasil dijadwalkan untuk ${formatIndoDate(date)}`,
        data: results,
      });
    } catch (error: any) {
      console.error("bulkAddInspectionItems error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 7. UPDATE INSPECTION ITEM
  // -------------------------------------------------------------
  updateInspectionItem: async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { serviceType, shift, status, inspectorName, notes } = req.body;

      const existing = await prisma.periodicInspectionItem.findUnique({
        where: { id },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Jadwal inspeksi tidak ditemukan" });
      }

      const updated = await prisma.periodicInspectionItem.update({
        where: { id },
        data: {
          serviceType: serviceType || undefined,
          shift: shift || undefined,
          status: status || undefined,
          inspectorName: inspectorName !== undefined ? inspectorName : undefined,
          notes: notes !== undefined ? notes : undefined,
        },
        include: { unit: true },
      });

      return res.json({
        success: true,
        message: "Jadwal inspeksi berhasil diperbarui",
        data: updated,
      });
    } catch (error: any) {
      console.error("updateInspectionItem error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 8. DELETE INSPECTION ITEM
  // -------------------------------------------------------------
  deleteInspectionItem: async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);

      const existing = await prisma.periodicInspectionItem.findUnique({
        where: { id },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Jadwal inspeksi tidak ditemukan" });
      }

      await prisma.periodicInspectionItem.delete({
        where: { id },
      });

      return res.json({
        success: true,
        message: `Unit ${existing.unitCode} dihapus dari jadwal inspeksi`,
      });
    } catch (error: any) {
      console.error("deleteInspectionItem error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // -------------------------------------------------------------
  // 9. APPLY STANDARD WEEKLY PI SCHEDULE (65 Units Muara Pahu)
  // -------------------------------------------------------------
  applyStandardWeeklySchedule: async (req: Request, res: Response) => {
    try {
      const { date, jobSite = "MuaraPahu" } = req.body;
      if (jobSite !== "MuaraPahu") {
        return res.status(400).json({
          success: false,
          message: "Jadwal template standar 65 unit saat ini khusus untuk Site Muara Pahu.",
        });
      }

      const { startDate, endDate, dates } = getWeekRange(date);

      const standardSchedule: Record<number, string[]> = {
        0: ["PM456", "PM457", "PM458", "PM459", "PM460", "PM461", "PM462", "PM463", "PM464"], // Senin (9)
        1: ["PM406", "PM413", "PM465", "PM466", "PM467", "PM468", "PM469", "PM470", "PM471"], // Selasa (9)
        2: ["PM401", "PM402", "PM404", "PM405", "PM408", "PM409", "PM410", "PM411", "PM412"], // Rabu (9)
        3: ["PM414", "PM415", "PM416", "PM417", "PM419", "PM420", "PM422", "PM423", "PM425"], // Kamis (9)
        4: ["PM426", "PM427", "PM429", "PM430", "PM431", "PM432", "PM433", "PM434", "PM435", "PM424"], // Jumat (10)
        5: ["PM436", "PM437", "PM438", "PM439", "PM440", "PM441", "PM442", "PM443", "PM444"], // Sabtu (9)
        6: ["PM445", "PM447", "PM448", "PM449", "PM450", "PM452", "PM453", "PM454", "PM455", "PM428"], // Minggu (10)
      };

      // Pre-fetch trailers
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

      let totalInserted = 0;
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const dStr = dates[dayIdx];
        const unitList = standardSchedule[dayIdx] || [];

        const plan = await prisma.periodicInspectionPlan.upsert({
          where: {
            jobSite_date: {
              jobSite: "MuaraPahu",
              date: dStr,
            },
          },
          update: {
            targetUnits: unitList.length,
          },
          create: {
            jobSite: "MuaraPahu",
            date: dStr,
            targetUnits: unitList.length,
          },
        });

        for (const unitCode of unitList) {
          const buntutSummary = trailerSummaryMap[unitCode] || "";
          await prisma.periodicInspectionItem.upsert({
            where: {
              planId_unitCode: {
                planId: plan.id,
                unitCode,
              },
            },
            update: {
              date: dStr,
              buntutSummary,
            },
            create: {
              planId: plan.id,
              date: dStr,
              unitCode,
              serviceType: "PI Regular",
              shift: "Shift 1",
              status: "Scheduled",
              buntutSummary,
            },
          });
          totalInserted++;
        }
      }

      return res.json({
        success: true,
        message: `Jadwal standar rutin mingguan (65 Unit Muara Pahu) berhasil diterapkan untuk minggu ${formatIndoDate(startDate)} s/d ${formatIndoDate(endDate)}. Total ${totalInserted} inspeksi unit terjadwal.`,
      });
    } catch (error: any) {
      console.error("applyStandardWeeklySchedule error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },
};
