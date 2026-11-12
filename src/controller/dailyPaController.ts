import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { JobSite } from "../generated/prisma/client";
import { normalizeHeadCode } from "../lib/plantHelpers";

const DEFAULT_CALENDAR_HOURS = 24;
const DEFAULT_TARGET_PA = 93;

/** Normalizes user-supplied job site strings into Prisma JobSite enum values. */
function parseJobSite(raw?: string | null): JobSite {
  const clean = (raw || "").trim().toLowerCase();
  if (clean === "senyiur" || clean === "sny") return "Senyiur";
  return "MuaraPahu";
}

/** Validates strict YYYY-MM-DD calendar format to reject invalid dates. */
function isValidIsoDate(raw?: string | null): raw is string {
  if (!raw) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const dt = new Date(y, m, d);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
}

/** Parses duration strings ("9 Jam", "1,5", "02:30") or numbers into decimal hours. */
export function parseDurationHours(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return null;
    return Math.round(raw * 100) / 100;
  }
  const str = String(raw).trim();
  if (!str || str.startsWith("-")) return null;

  // Handle "HH:MM" duration notation e.g. "02:30" -> 2.5
  const hhmm = /^(\d{1,2}):(\d{2})(?:\s*jam)?$/i.exec(str);
  if (hhmm) {
    const h = Number(hhmm[1]);
    const mins = Number(hhmm[2]);
    if (Number.isFinite(h) && Number.isFinite(mins) && mins < 60) {
      return Math.round((h + mins / 60) * 100) / 100;
    }
  }

  const numMatch = str.match(/\d+(?:[.,]\d+)?/);
  if (!numMatch) return null;
  const parsed = Number(numMatch[0].replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function buildPiActivityText(pi: {
  serviceType: string;
  notes: string | null;
}): string {
  const note = (pi.notes || "").trim();
  return note ? `${pi.serviceType} - ${note}` : pi.serviceType;
}

function buildPsActivityText(ps: {
  serviceType: string;
  category: string | null;
  notes: string | null;
}): string {
  const base = ps.category ? `${ps.serviceType} (${ps.category})` : ps.serviceType;
  const note = (ps.notes || "").trim();
  return note ? `${base} - ${note}` : base;
}

/** Imports missing PI & PS records on (jobSite, date) for existing unit entries without overwriting manual edits. */
async function syncMissingPiPsForReport(params: {
  reportId: string;
  jobSite: JobSite;
  date: string;
  filterUnitCodes?: string[];
}): Promise<{ addedCount: number; updatedCount: number }> {
  const { reportId, jobSite, date, filterUnitCodes } = params;

  const entries = await prisma.dailyPaUnitEntry.findMany({
    where: {
      reportId,
      ...(filterUnitCodes && filterUnitCodes.length > 0
        ? { unitCode: { in: filterUnitCodes } }
        : {}),
    },
    include: {
      activities: true,
    },
  });

  if (entries.length === 0) {
    return { addedCount: 0, updatedCount: 0 };
  }

  const targetUnitCodes = entries.map((e) => e.unitCode);

  const [piItems, psItems] = await Promise.all([
    prisma.periodicInspectionItem.findMany({
      where: {
        date,
        unitCode: { in: targetUnitCodes },
        plan: { jobSite },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.preventiveMaintenanceItem.findMany({
      where: {
        date,
        unitCode: { in: targetUnitCodes },
        plan: { jobSite },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const piByUnit = new Map<string, typeof piItems>();
  for (const item of piItems) {
    const list = piByUnit.get(item.unitCode) || [];
    list.push(item);
    piByUnit.set(item.unitCode, list);
  }

  const psByUnit = new Map<string, typeof psItems>();
  for (const item of psItems) {
    const list = psByUnit.get(item.unitCode) || [];
    list.push(item);
    psByUnit.set(item.unitCode, list);
  }

  let addedCount = 0;
  let updatedCount = 0;

  for (const entry of entries) {
    const dismissed = new Set(entry.dismissedSources || []);
    const existingBySourceKey = new Map(
      entry.activities
        .filter((a) => a.sourceItemId)
        .map((a) => [`${a.sourceType}:${a.sourceItemId}`, a])
    );

    let nextOrder =
      entry.activities.reduce((max, a) => Math.max(max, a.sortOrder), -1) + 1;

    for (const pi of piByUnit.get(entry.unitCode) || []) {
      const key = `PI:${pi.id}`;
      if (dismissed.has(key) || existingBySourceKey.has(key)) continue;

      await prisma.dailyPaActivity.create({
        data: {
          unitEntryId: entry.id,
          sourceType: "PI",
          sourceItemId: pi.id,
          activityText: buildPiActivityText(pi),
          breakdownTime: null,
          durationHours: 0,
          sortOrder: nextOrder++,
        },
      });
      addedCount++;
    }

    for (const ps of psByUnit.get(entry.unitCode) || []) {
      const key = `PS:${ps.id}`;
      if (dismissed.has(key)) continue;

      const parsedHours = parseDurationHours(ps.actualLeadTime) ?? 0;
      const startTime =
        (ps.actualStartTime || ps.planStartTime || "").trim() || null;

      const existing = existingBySourceKey.get(key);
      if (!existing) {
        await prisma.dailyPaActivity.create({
          data: {
            unitEntryId: entry.id,
            sourceType: "PS",
            sourceItemId: ps.id,
            activityText: buildPsActivityText(ps),
            breakdownTime: startTime,
            durationHours: parsedHours,
            sortOrder: nextOrder++,
          },
        });
        addedCount++;
      } else if (existing.durationHours === 0 && parsedHours > 0) {
        await prisma.dailyPaActivity.update({
          where: { id: existing.id },
          data: {
            durationHours: parsedHours,
            ...(existing.breakdownTime ? {} : { breakdownTime: startTime }),
          },
        });
        updatedCount++;
      }
    }
  }

  return { addedCount, updatedCount };
}

/** Loads and computes full unit rows, PA%, MTTR, MTBF, and report summary for a (jobSite, date). */
async function loadComputedReportPayload(jobSite: JobSite, date: string) {
  const report = await prisma.dailyPaReport.findUnique({
    where: { jobSite_date: { jobSite, date } },
    include: {
      units: {
        include: {
          unit: true,
          activities: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  const calendarHours = report?.calendarHours ?? DEFAULT_CALENDAR_HOURS;
  const targetPa = report?.targetPa ?? DEFAULT_TARGET_PA;

  const sortedEntries = [...(report?.units || [])].sort((a, b) => {
    const catOrder = (cat?: string) => (cat === "Prime Mover" ? 0 : 1);
    const diffCat = catOrder(a.unit?.category) - catOrder(b.unit?.category);
    if (diffCat !== 0) return diffCat;
    const diffNum = (a.unit?.unitNumber ?? 999999) - (b.unit?.unitNumber ?? 999999);
    if (diffNum !== 0) return diffNum;
    return a.unitCode.localeCompare(b.unitCode);
  });

  let totalBd = 0;
  let totalDowntime = 0;
  let totalAvailableHours = 0;
  let breakdownUnitCount = 0;
  let belowTargetUnitCount = 0;

  const computedUnits = sortedEntries.map((entry, idx) => {
    const bdCount = entry.activities.length;
    const unitDowntime = round2(
      entry.activities.reduce((sum, a) => sum + (Number(a.durationHours) || 0), 0)
    );
    const availableHours = Math.max(0, round2(calendarHours - unitDowntime));
    const paPercent =
      calendarHours > 0 ? round1((availableHours / calendarHours) * 100) : 100;
    const mttr = bdCount > 0 ? round1(unitDowntime / bdCount) : null;
    const mtbf = bdCount > 0 ? round1(availableHours / bdCount) : null;

    const breakdownTimes = entry.activities
      .map((a) => (a.breakdownTime || "").trim())
      .filter(Boolean);

    const hasMissingPiPsHours = entry.activities.some(
      (a) => a.sourceType !== "MANUAL" && (Number(a.durationHours) || 0) <= 0
    );

    totalBd += bdCount;
    totalDowntime += unitDowntime;
    totalAvailableHours += availableHours;
    if (bdCount > 0) breakdownUnitCount++;
    if (paPercent < targetPa) belowTargetUnitCount++;

    return {
      id: entry.id,
      no: idx + 1,
      unitCode: entry.unitCode,
      category: entry.unit?.category || "",
      brand: entry.unit?.brand || "",
      model: entry.unit?.model || "",
      bdCount,
      totalDowntime: unitDowntime,
      availableHours,
      paPercent,
      isBelowTarget: paPercent < targetPa,
      breakdownTimesJoined: breakdownTimes.length > 0 ? breakdownTimes.join(", ") : "-",
      mttr,
      mtbf,
      hasMissingPiPsHours,
      activities: entry.activities.map((a) => ({
        id: a.id,
        unitEntryId: a.unitEntryId,
        sourceType: a.sourceType,
        sourceItemId: a.sourceItemId,
        activityText: a.activityText,
        breakdownTime: a.breakdownTime || "",
        durationHours: round2(Number(a.durationHours) || 0),
        sortOrder: a.sortOrder,
      })),
    };
  });

  const totalUnits = computedUnits.length;
  const totalCalendarHours = round2(totalUnits * calendarHours);
  const roundedDowntime = round2(totalDowntime);
  const roundedAvailable = round2(totalAvailableHours);
  const overallPaPercent =
    totalCalendarHours > 0 ? round1((roundedAvailable / totalCalendarHours) * 100) : 100;
  const overallMttr = totalBd > 0 ? round2(roundedDowntime / totalBd) : null;
  const overallMtbf = totalBd > 0 ? round2(roundedAvailable / totalBd) : null;

  return {
    report: {
      id: report?.id || null,
      date,
      jobSite,
      calendarHours,
      targetPa,
      notes: report?.notes || "",
    },
    summary: {
      totalUnits,
      totalBd,
      totalDowntime: roundedDowntime,
      totalAvailableHours: roundedAvailable,
      totalCalendarHours,
      overallPaPercent,
      breakdownUnitCount,
      belowTargetUnitCount,
      overallMttr,
      overallMtbf,
    },
    units: computedUnits,
  };
}

export const dailyPaController = {
  // 1. GET DAILY PA REPORT FOR A SPECIFIC DATE & JOBSITE
  getDailyPaReport: async (req: Request, res: Response) => {
    try {
      const dateRaw = req.query.date ? String(req.query.date) : "";
      if (!isValidIsoDate(dateRaw)) {
        return res.status(400).json({
          success: false,
          message: "Parameter date wajib diisi dengan format YYYY-MM-DD",
        });
      }
      const jobSite = parseJobSite(
        req.query.jobSite ? String(req.query.jobSite) : "MuaraPahu"
      );

      const report = await prisma.dailyPaReport.findUnique({
        where: { jobSite_date: { jobSite, date: dateRaw } },
        select: { id: true },
      });

      let syncMeta = { addedCount: 0, updatedCount: 0 };
      if (report) {
        syncMeta = await syncMissingPiPsForReport({
          reportId: report.id,
          jobSite,
          date: dateRaw,
        });
      }

      const payload = await loadComputedReportPayload(jobSite, dateRaw);
      return res.json({
        success: true,
        data: payload,
        syncMeta,
      });
    } catch (error: any) {
      console.error("getDailyPaReport error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 2. GET MONTHLY CALENDAR SUMMARY (PER-DATE PA% & UNIT COUNT)
  getMonthlyCalendarSummary: async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const year = req.query.year ? parseInt(String(req.query.year), 10) : now.getFullYear();
      const month = req.query.month ? parseInt(String(req.query.month), 10) : now.getMonth() + 1;
      const jobSite = req.query.jobSite ? parseJobSite(String(req.query.jobSite)) : null;

      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return res.status(400).json({
          success: false,
          message: "Parameter year dan month (1-12) harus valid",
        });
      }

      const mm = String(month).padStart(2, "0");
      const lastDay = new Date(year, month, 0).getDate();
      const startDate = `${year}-${mm}-01`;
      const endDate = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;

      const reports = await prisma.dailyPaReport.findMany({
        where: {
          ...(jobSite ? { jobSite } : {}),
          date: { gte: startDate, lte: endDate },
        },
        include: {
          units: {
            include: { activities: true },
          },
        },
        orderBy: [{ date: "asc" }, { jobSite: "asc" }],
      });

      const daysMap: Record<
        string,
        {
          date: string;
          totalUnits: number;
          totalBd: number;
          breakdownUnitCount: number;
          belowTargetUnitCount: number;
          overallPaPercent: number;
          targetPa: number;
        }
      > = {};

      // Aggregate by date cleanly (even if site selector isn't pinned)
      const groupedByDate = new Map<string, typeof reports>();
      for (const r of reports) {
        const list = groupedByDate.get(r.date) || [];
        list.push(r);
        groupedByDate.set(r.date, list);
      }

      for (const [dateStr, dateReports] of groupedByDate.entries()) {
        let totalUnits = 0;
        let totalBd = 0;
        let breakdownUnitCount = 0;
        let belowTargetUnitCount = 0;
        let sumAvail = 0;
        let sumCal = 0;
        const targetPa = dateReports[0]?.targetPa ?? DEFAULT_TARGET_PA;

        for (const r of dateReports) {
          const calHours = r.calendarHours || DEFAULT_CALENDAR_HOURS;
          for (const entry of r.units) {
            totalUnits++;
            const bd = entry.activities.length;
            const downtime = entry.activities.reduce(
              (acc, a) => acc + (Number(a.durationHours) || 0),
              0
            );
            const avail = Math.max(0, calHours - downtime);
            const unitPa = calHours > 0 ? round1((avail / calHours) * 100) : 100;

            totalBd += bd;
            if (bd > 0) breakdownUnitCount++;
            if (unitPa < r.targetPa) belowTargetUnitCount++;
            sumAvail += avail;
            sumCal += calHours;
          }
        }

        if (totalUnits > 0) {
          daysMap[dateStr] = {
            date: dateStr,
            totalUnits,
            totalBd,
            breakdownUnitCount,
            belowTargetUnitCount,
            overallPaPercent: sumCal > 0 ? round1((sumAvail / sumCal) * 100) : 100,
            targetPa,
          };
        }
      }

      return res.json({
        success: true,
        data: {
          year,
          month,
          days: Object.values(daysMap),
        },
      });
    } catch (error: any) {
      console.error("getMonthlyCalendarSummary error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 3. UPDATE REPORT SETTINGS (CALENDAR HOURS / TARGET PA)
  updateDailyPaSettings: async (req: Request, res: Response) => {
    try {
      const { date, jobSite: rawSite, calendarHours, targetPa, notes } = req.body;
      if (!isValidIsoDate(date)) {
        return res.status(400).json({
          success: false,
          message: "Tanggal (date) harus format YYYY-MM-DD",
        });
      }
      const jobSite = parseJobSite(rawSite);

      const parsedCal =
        calendarHours !== undefined ? Number(calendarHours) : undefined;
      if (parsedCal !== undefined && (!Number.isFinite(parsedCal) || parsedCal <= 0 || parsedCal > 24)) {
        return res.status(400).json({
          success: false,
          message: "Jam kalender/hari harus di antara 0.1 hingga 24 jam",
        });
      }

      const parsedTarget = targetPa !== undefined ? Number(targetPa) : undefined;
      if (parsedTarget !== undefined && (!Number.isFinite(parsedTarget) || parsedTarget < 0 || parsedTarget > 100)) {
        return res.status(400).json({
          success: false,
          message: "Target PA (%) harus di antara 0 hingga 100",
        });
      }

      await prisma.dailyPaReport.upsert({
        where: { jobSite_date: { jobSite, date } },
        update: {
          ...(parsedCal !== undefined ? { calendarHours: round2(parsedCal) } : {}),
          ...(parsedTarget !== undefined ? { targetPa: round1(parsedTarget) } : {}),
          ...(notes !== undefined ? { notes: String(notes || "") || null } : {}),
        },
        create: {
          jobSite,
          date,
          calendarHours: parsedCal !== undefined ? round2(parsedCal) : DEFAULT_CALENDAR_HOURS,
          targetPa: parsedTarget !== undefined ? round1(parsedTarget) : DEFAULT_TARGET_PA,
          notes: notes !== undefined ? String(notes || "") || null : null,
        },
      });

      const payload = await loadComputedReportPayload(jobSite, date);
      return res.json({
        success: true,
        message: "Pengaturan Daily PA berhasil diperbarui",
        data: payload,
      });
    } catch (error: any) {
      console.error("updateDailyPaSettings error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 4. BULK ADD UNITS INTO A DATE'S DAILY PA REPORT + AUTO-IMPORT PI & PS
  addUnitsToDailyPa: async (req: Request, res: Response) => {
    try {
      const { date, jobSite: rawSite, unitCodes } = req.body;
      if (!isValidIsoDate(date)) {
        return res.status(400).json({
          success: false,
          message: "Tanggal (date) wajib diisi dalam format YYYY-MM-DD",
        });
      }
      if (!Array.isArray(unitCodes) || unitCodes.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Pilih minimal 1 kode unit untuk ditambahkan",
        });
      }

      const jobSite = parseJobSite(rawSite);
      const normalizedCodes = Array.from(
        new Set(
          unitCodes
            .map((c: unknown) => normalizeHeadCode(String(c || "")))
            .filter(Boolean)
        )
      );

      if (normalizedCodes.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Daftar kode unit tidak valid",
        });
      }

      const validMasterUnits = await prisma.masterUnit.findMany({
        where: { unitCode: { in: normalizedCodes } },
        select: { unitCode: true },
      });
      const validCodeSet = new Set(validMasterUnits.map((u) => u.unitCode));
      const codesToInsert = normalizedCodes.filter((c) => validCodeSet.has(c));

      if (codesToInsert.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Kode unit tidak ditemukan di Master Data Unit",
        });
      }

      const report = await prisma.dailyPaReport.upsert({
        where: { jobSite_date: { jobSite, date } },
        update: {},
        create: {
          jobSite,
          date,
          calendarHours: DEFAULT_CALENDAR_HOURS,
          targetPa: DEFAULT_TARGET_PA,
        },
      });

      const createManyRes = await prisma.dailyPaUnitEntry.createMany({
        data: codesToInsert.map((unitCode) => ({
          reportId: report.id,
          unitCode,
        })),
        skipDuplicates: true,
      });

      const syncMeta = await syncMissingPiPsForReport({
        reportId: report.id,
        jobSite,
        date,
        filterUnitCodes: codesToInsert,
      });

      const payload = await loadComputedReportPayload(jobSite, date);
      return res.json({
        success: true,
        message: `${createManyRes.count} unit ditambahkan (${syncMeta.addedCount} aktivitas dari PI/PS ditarik otomatis).`,
        addedUnitsCount: createManyRes.count,
        syncMeta,
        data: payload,
      });
    } catch (error: any) {
      console.error("addUnitsToDailyPa error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 5. REMOVE UNIT ENTRY FROM DAILY PA REPORT
  removeUnitFromDailyPa: async (req: Request, res: Response) => {
    try {
      const entryId = String(req.params.entryId || "").trim();
      if (!entryId) {
        return res.status(400).json({ success: false, message: "ID unit entry tidak valid" });
      }

      const entry = await prisma.dailyPaUnitEntry.findUnique({
        where: { id: entryId },
        include: { report: true },
      });
      if (!entry) {
        return res.status(404).json({ success: false, message: "Unit entry tidak ditemukan" });
      }

      await prisma.dailyPaUnitEntry.delete({ where: { id: entry.id } });
      const payload = await loadComputedReportPayload(entry.report.jobSite, entry.report.date);

      return res.json({
        success: true,
        message: `Unit ${entry.unitCode} dihapus dari Daily PA ${entry.report.date}`,
        data: payload,
      });
    } catch (error: any) {
      console.error("removeUnitFromDailyPa error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 6. MANUAL TRIGGER TO SYNC PI & PS ACTIVITIES FOR ALL UNITS IN REPORT
  syncPiPsToDailyPa: async (req: Request, res: Response) => {
    try {
      const { date, jobSite: rawSite } = req.body;
      if (!isValidIsoDate(date)) {
        return res.status(400).json({
          success: false,
          message: "Tanggal (date) wajib format YYYY-MM-DD",
        });
      }
      const jobSite = parseJobSite(rawSite);

      const report = await prisma.dailyPaReport.findUnique({
        where: { jobSite_date: { jobSite, date } },
        select: { id: true },
      });

      if (!report) {
        return res.json({
          success: true,
          message: "Belum ada unit terdaftar pada tanggal ini. Pilih unit terlebih dahulu.",
          syncMeta: { addedCount: 0, updatedCount: 0 },
          data: await loadComputedReportPayload(jobSite, date),
        });
      }

      const syncMeta = await syncMissingPiPsForReport({
        reportId: report.id,
        jobSite,
        date,
      });

      const payload = await loadComputedReportPayload(jobSite, date);
      return res.json({
        success: true,
        message: `Sinkronisasi PI & PS selesai (${syncMeta.addedCount} aktivitas baru, ${syncMeta.updatedCount} jam diperbarui).`,
        syncMeta,
        data: payload,
      });
    } catch (error: any) {
      console.error("syncPiPsToDailyPa error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 7. ADD BD ACTIVITY FOR A UNIT ROW
  addActivity: async (req: Request, res: Response) => {
    try {
      const { unitEntryId, activityText, breakdownTime, durationHours } = req.body;
      if (!unitEntryId) {
        return res.status(400).json({ success: false, message: "unitEntryId wajib diisi" });
      }
      const cleanText = String(activityText || "").trim();
      if (!cleanText) {
        return res.status(400).json({
          success: false,
          message: "Deskripsi BD Activity wajib diisi",
        });
      }

      const parsedHours =
        durationHours === undefined || durationHours === null || durationHours === ""
          ? 0
          : parseDurationHours(durationHours);

      if (parsedHours === null) {
        return res.status(400).json({
          success: false,
          message: "Total jam downtime harus angka non-negatif yang valid",
        });
      }

      const entry = await prisma.dailyPaUnitEntry.findUnique({
        where: { id: String(unitEntryId) },
        include: {
          report: true,
          activities: { select: { sortOrder: true } },
        },
      });
      if (!entry) {
        return res.status(404).json({ success: false, message: "Unit entry tidak ditemukan" });
      }

      const nextSort =
        entry.activities.reduce((max, a) => Math.max(max, a.sortOrder), -1) + 1;

      await prisma.dailyPaActivity.create({
        data: {
          unitEntryId: entry.id,
          sourceType: "MANUAL",
          sourceItemId: null,
          activityText: cleanText,
          breakdownTime: breakdownTime ? String(breakdownTime).trim() : null,
          durationHours: parsedHours,
          sortOrder: nextSort,
        },
      });

      const payload = await loadComputedReportPayload(entry.report.jobSite, entry.report.date);
      return res.json({
        success: true,
        message: "BD Activity berhasil ditambahkan",
        data: payload,
      });
    } catch (error: any) {
      console.error("addActivity error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 8. UPDATE BD ACTIVITY (INLINE DURATION FOR PI/PS OR FULL EDIT)
  updateActivity: async (req: Request, res: Response) => {
    try {
      const activityId = String(req.params.activityId || "").trim();
      if (!activityId) {
        return res.status(400).json({ success: false, message: "activityId wajib diisi" });
      }

      const existing = await prisma.dailyPaActivity.findUnique({
        where: { id: activityId },
        include: {
          unitEntry: {
            include: { report: true },
          },
        },
      });
      if (!existing) {
        return res.status(404).json({ success: false, message: "BD Activity tidak ditemukan" });
      }

      const { activityText, breakdownTime, durationHours } = req.body;
      const patch: {
        activityText?: string;
        breakdownTime?: string | null;
        durationHours?: number;
      } = {};

      if (activityText !== undefined) {
        const clean = String(activityText).trim();
        if (!clean) {
          return res.status(400).json({
            success: false,
            message: "Deskripsi BD Activity tidak boleh kosong",
          });
        }
        patch.activityText = clean;
      }

      if (breakdownTime !== undefined) {
        const cleanTime = String(breakdownTime || "").trim();
        patch.breakdownTime = cleanTime || null;
      }

      if (durationHours !== undefined) {
        const parsed =
          durationHours === "" || durationHours === null
            ? 0
            : parseDurationHours(durationHours);
        if (parsed === null) {
          return res.status(400).json({
            success: false,
            message: "Total jam harus angka non-negatif yang valid (contoh: 1.5 atau 01:30)",
          });
        }
        patch.durationHours = parsed;
      }

      await prisma.dailyPaActivity.update({
        where: { id: existing.id },
        data: patch,
      });

      const payload = await loadComputedReportPayload(
        existing.unitEntry.report.jobSite,
        existing.unitEntry.report.date
      );
      return res.json({
        success: true,
        message: "BD Activity diperbarui",
        data: payload,
      });
    } catch (error: any) {
      console.error("updateActivity error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 9. DELETE BD ACTIVITY (ALSO RECORDS DISMISSED PI/PS SOURCE SO IT DOESN'T AUTO-RESPAWN)
  deleteActivity: async (req: Request, res: Response) => {
    try {
      const activityId = String(req.params.activityId || "").trim();
      if (!activityId) {
        return res.status(400).json({ success: false, message: "activityId wajib diisi" });
      }

      const existing = await prisma.dailyPaActivity.findUnique({
        where: { id: activityId },
        include: {
          unitEntry: {
            include: { report: true },
          },
        },
      });
      if (!existing) {
        return res.status(404).json({ success: false, message: "BD Activity tidak ditemukan" });
      }

      await prisma.$transaction(async (tx) => {
        if (existing.sourceItemId && existing.sourceType !== "MANUAL") {
          const sourceKey = `${existing.sourceType}:${existing.sourceItemId}`;
          const prevDismissed = existing.unitEntry.dismissedSources || [];
          if (!prevDismissed.includes(sourceKey)) {
            await tx.dailyPaUnitEntry.update({
              where: { id: existing.unitEntry.id },
              data: {
                dismissedSources: [...prevDismissed, sourceKey],
              },
            });
          }
        }
        await tx.dailyPaActivity.delete({ where: { id: existing.id } });
      });

      const payload = await loadComputedReportPayload(
        existing.unitEntry.report.jobSite,
        existing.unitEntry.report.date
      );
      return res.json({
        success: true,
        message: "BD Activity berhasil dihapus",
        data: payload,
      });
    } catch (error: any) {
      console.error("deleteActivity error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },
};
