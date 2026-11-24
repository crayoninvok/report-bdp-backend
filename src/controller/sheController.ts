import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// Month name map for formatting monthly trends (e.g. 8 -> "Agu 26")
const MONTH_NAMES: Record<number, string> = {
  1: "Jan",
  2: "Feb",
  3: "Mar",
  4: "Apr",
  5: "Mei",
  6: "Jun",
  7: "Jul",
  8: "Agu",
  9: "Sep",
  10: "Okt",
  11: "Nov",
  12: "Des",
};

export const getHazards = async (req: Request, res: Response) => {
  try {
    const { site, search, status, jenis, limit, offset } = req.query;

    const where: any = {};

    // Site filtering
    if (site && site !== "ALL") {
      const siteStr = String(site).replace(/[\s_-]+/g, "").toUpperCase();
      if (siteStr.includes("MUARA") || siteStr.includes("PAHU") || siteStr === "MP") {
        where.jobSite = "MuaraPahu";
      } else if (siteStr.includes("SENYIUR") || siteStr === "SY") {
        where.jobSite = "Senyiur";
      } else if (site === "MuaraPahu" || site === "Senyiur") {
        where.jobSite = site;
      }
    }

    // Status filtering
    if (status && status !== "ALL") {
      const statusUpper = String(status).toUpperCase();
      where.statusGForm = statusUpper === "CLOSE" ? "CLOSE" : "OPEN";
    }

    // Jenis pelaporan filtering (KTA / TTA)
    if (jenis && jenis !== "ALL") {
      const jenisUpper = String(jenis).toUpperCase();
      where.jenisPelaporan = jenisUpper === "TTA" ? "TTA" : "KTA";
    }

    // Search query
    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { reportNumber: { contains: q, mode: "insensitive" } },
        { reporterName: { contains: q, mode: "insensitive" } },
        { reporterNrp: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { lokasiBahaya: { contains: q, mode: "insensitive" } },
        { identifikasiBahaya: { contains: q, mode: "insensitive" } },
        { penanggungJawabArea: { contains: q, mode: "insensitive" } },
      ];
    }

    const take = limit ? Math.min(Math.max(Number(limit), 1), 2000) : 2000;
    const skip = offset ? Math.max(Number(offset), 0) : 0;

    const [total, records] = await Promise.all([
      (prisma as any).hazardReport.count({ where }),
      (prisma as any).hazardReport.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take,
        skip,
      }),
    ]);

    // Format records to match frontend expectations
    const formatted = records.map((r: any) => ({
      id: r.id,
      reportNumber: r.reportNumber,
      date: r.date ? new Date(r.date).toISOString().slice(0, 10) : "",
      time: r.time || "08:00",
      jobSite: r.jobSite,
      project: r.project,
      location: r.location || r.lokasiBahaya || "WORKSHOP",
      category: r.category,
      riskLevel: r.riskLevel,
      title: r.title,
      description: r.description || "",
      immediateAction: r.immediateAction || "",
      correctiveAction: r.correctiveAction || r.tindakanPerbaikan || "",
      reporterName: r.reporterName,
      reporterNrp: r.reporterNrp || "",
      reporterDept: r.reporterDept || "PLANT",
      reporterJobTitle: r.reporterJobTitle || "",
      picName: r.picName || r.penanggungJawabArea || "PLANT",
      picDept: r.picDept || r.penanggungJawabArea || "PLANT",
      dueDate: r.dueDate ? new Date(r.dueDate).toISOString().slice(0, 10) : "",
      completionDate: r.completionDate ? new Date(r.completionDate).toISOString().slice(0, 10) : undefined,
      status: r.status,
      statusGForm: r.statusGForm,
      jenisPelaporan: r.jenisPelaporan,
      lokasiBahaya: r.lokasiBahaya || r.location,
      identifikasiBahaya: r.identifikasiBahaya || r.title,
      rincianBahaya: r.rincianBahaya || r.description || "",
      tindakanPerbaikan: r.tindakanPerbaikan || r.correctiveAction || "",
      penanggungJawabArea: r.penanggungJawabArea || r.picName || "PLANT",
      dokumentasiSebelum: r.dokumentasiSebelum || undefined,
      dokumentasiSesudah: r.dokumentasiSesudah || undefined,
      photoUrl: r.dokumentasiSebelum || undefined,
      evidenceUrl: r.dokumentasiSesudah || undefined,
      namaPelapor: r.reporterName,
      nrpPelapor: r.reporterNrp || "",
      departemenPelapor: r.reporterDept || "PLANT",
      jabatanPelapor: r.reporterJobTitle || "",
      tanggalPelaporan: r.date ? new Date(r.date).toISOString().slice(0, 10) : "",
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    }));

    res.json({
      success: true,
      total,
      count: formatted.length,
      data: formatted,
    });
  } catch (err: any) {
    console.error("Error fetching hazards:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to fetch hazard reports" });
  }
};

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const { site } = req.query;

    const where: any = {};
    if (site && site !== "ALL") {
      const siteStr = String(site).replace(/[\s_-]+/g, "").toUpperCase();
      if (siteStr.includes("MUARA") || siteStr.includes("PAHU") || siteStr === "MP") {
        where.jobSite = "MuaraPahu";
      } else if (siteStr.includes("SENYIUR") || siteStr === "SY") {
        where.jobSite = "Senyiur";
      } else if (site === "MuaraPahu" || site === "Senyiur") {
        where.jobSite = site;
      }
    }

    // Fetch all records for aggregation
    const [records, inspections, observations] = await Promise.all([
      (prisma as any).hazardReport.findMany({
        where,
        select: {
          id: true,
          date: true,
          category: true,
          riskLevel: true,
          status: true,
          statusGForm: true,
          jenisPelaporan: true,
          lokasiBahaya: true,
          month: true,
          week: true,
        },
      }),
      (prisma as any).workAreaInspection.findMany({
        where,
        select: {
          id: true,
          tanggalInspeksi: true,
          status: true,
          shift: true,
          lokasiInspeksi: true,
          complianceScore: true,
          findingsCount: true,
          month: true,
          week: true,
        },
      }),
      (prisma as any).safetyObservation.findMany({
        where,
        select: {
          id: true,
          tanggalObservasi: true,
          status: true,
          lokasiObservasi: true,
          perubahanPosisi: true,
          penghentianPekerjaan: true,
          penggantianTool: true,
          month: true,
          week: true,
        },
      }),
    ]);

    const totalHazards = records.length;
    const openHazards = records.filter((r: any) => r.statusGForm === "OPEN").length;
    const closedHazards = records.filter((r: any) => r.statusGForm === "CLOSE").length;
    const inProgressHazards = records.filter((r: any) => r.status === "In Progress").length;
    const ktaCount = records.filter((r: any) => r.jenisPelaporan === "KTA").length;
    const ttaCount = records.filter((r: any) => r.jenisPelaporan === "TTA").length;
    const resolutionRate = totalHazards > 0 ? Math.round((closedHazards / totalHazards) * 100) : 100;

    // Monthly trends (group by YYYY-MM)
    const monthMap = new Map<
      string,
      {
        month: string;
        rawKey: string;
        hazards: number;
        resolved: number;
        open: number;
        kta: number;
        tta: number;
        inspections: number;
        inspectionsCompliant: number;
        inspectionsNeedFollowUp: number;
        inspectionsShift1: number;
        inspectionsShift2: number;
      }
    >();

    const getMonthEntry = (d: Date) => {
      const m = d.getMonth() + 1;
      const y = String(d.getFullYear()).slice(-2);
      const key = `${d.getFullYear()}-${String(m).padStart(2, "0")}`;
      const label = `${MONTH_NAMES[m] || m} ${y}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          month: label,
          rawKey: key,
          hazards: 0,
          resolved: 0,
          open: 0,
          kta: 0,
          tta: 0,
          inspections: 0,
          inspectionsCompliant: 0,
          inspectionsNeedFollowUp: 0,
          inspectionsShift1: 0,
          inspectionsShift2: 0,
        });
      }
      return monthMap.get(key)!;
    };

    records.forEach((r: any) => {
      if (!r.date) return;
      const d = new Date(r.date);
      const entry = getMonthEntry(d);
      entry.hazards++;
      if (r.jenisPelaporan === "TTA") entry.tta++;
      else entry.kta++;
      if (r.statusGForm === "CLOSE" || r.status === "Closed") {
        entry.resolved++;
      } else {
        entry.open++;
      }
    });

    inspections.forEach((ins: any) => {
      if (!ins.tanggalInspeksi) return;
      const d = new Date(ins.tanggalInspeksi);
      const entry = getMonthEntry(d);
      entry.inspections++;
      if (ins.status === "Compliant") {
        entry.inspectionsCompliant++;
      } else {
        entry.inspectionsNeedFollowUp++;
      }
      if (ins.shift === "SHIFT 2") {
        entry.inspectionsShift2++;
      } else {
        entry.inspectionsShift1++;
      }
    });

    const sortedMonthKeys = Array.from(monthMap.keys()).sort();
    const monthlyTrends = sortedMonthKeys.map((k) => monthMap.get(k)!);

    // Weekly Trends
    const weekMap = new Map<
      string,
      {
        week: string;
        label: string;
        hazards: number;
        open: number;
        resolved: number;
        kta: number;
        tta: number;
        inspections: number;
        inspectionsShift1: number;
        inspectionsShift2: number;
        compliant: number;
        needFollowUp: number;
      }
    >();

    const getWeekKey = (d: Date, customWeek?: number) => {
      if (customWeek && customWeek > 0 && customWeek <= 53) {
        return `W${String(customWeek).padStart(2, "0")}`;
      }
      const tempDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = tempDate.getUTCDay() || 7;
      tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
      const wNo = Math.ceil(((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `W${String(wNo).padStart(2, "0")}`;
    };

    records.forEach((r: any) => {
      if (!r.date) return;
      const d = new Date(r.date);
      const wk = getWeekKey(d, r.week);
      if (!weekMap.has(wk)) {
        weekMap.set(wk, {
          week: wk,
          label: `Minggu ${wk.replace("W", "")}`,
          hazards: 0,
          open: 0,
          resolved: 0,
          kta: 0,
          tta: 0,
          inspections: 0,
          inspectionsShift1: 0,
          inspectionsShift2: 0,
          compliant: 0,
          needFollowUp: 0,
        });
      }
      const entry = weekMap.get(wk)!;
      entry.hazards++;
      if (r.jenisPelaporan === "TTA") entry.tta++;
      else entry.kta++;
      if (r.statusGForm === "CLOSE" || r.status === "Closed") {
        entry.resolved++;
      } else {
        entry.open++;
      }
    });

    inspections.forEach((ins: any) => {
      if (!ins.tanggalInspeksi) return;
      const d = new Date(ins.tanggalInspeksi);
      const wk = getWeekKey(d, ins.week);
      if (!weekMap.has(wk)) {
        weekMap.set(wk, {
          week: wk,
          label: `Minggu ${wk.replace("W", "")}`,
          hazards: 0,
          open: 0,
          resolved: 0,
          kta: 0,
          tta: 0,
          inspections: 0,
          inspectionsShift1: 0,
          inspectionsShift2: 0,
          compliant: 0,
          needFollowUp: 0,
        });
      }
      const entry = weekMap.get(wk)!;
      entry.inspections++;
      if (ins.shift === "SHIFT 2") entry.inspectionsShift2++;
      else entry.inspectionsShift1++;
      if (ins.status === "Compliant") {
        entry.compliant++;
      } else {
        entry.needFollowUp++;
      }
    });

    const sortedWeekKeys = Array.from(weekMap.keys()).sort();
    const weeklyTrends = sortedWeekKeys
      .map((k) => weekMap.get(k)!)
      .filter((w) => w.hazards > 0 || w.inspections > 0);

    // Inspections Summary
    const totalInspections = inspections.length;
    const compliantInspections = inspections.filter((i: any) => i.status === "Compliant").length;
    const needFollowUpInspections = inspections.filter((i: any) => i.status === "Need Follow Up").length;
    const shift1Inspections = inspections.filter((i: any) => i.shift === "SHIFT 1").length;
    const shift2Inspections = inspections.filter((i: any) => i.shift === "SHIFT 2").length;
    const avgScoreInspections =
      totalInspections > 0
        ? Math.round(
            (inspections.reduce((sum: number, curr: any) => sum + (Number(curr.complianceScore) || 100), 0) /
              totalInspections) *
              10
          ) / 10
        : 100;

    // Safety Observations Summary
    const totalObservations = observations.length;
    const safeObservations = observations.filter((o: any) => o.status === "AMAN").length;
    const riskyObservations = observations.filter((o: any) => o.status === "BERISIKO").length;
    const safeRatePct = totalObservations > 0 ? Math.round((safeObservations / totalObservations) * 100) : 100;

    // Category distribution
    const categoryCounts: Record<string, number> = {};
    records.forEach((r: any) => {
      const cat = r.category || "Unsafe Condition";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const categoryColors: Record<string, string> = {
      "Unsafe Condition": "#e95623",
      "Unsafe Action": "#f59e0b",
      "Environmental": "#10b981",
      "Near Miss": "#ef4444",
      "Health & Hygiene": "#6366f1",
    };

    let categoryDistribution = Object.keys(categoryCounts).map((cat) => ({
      name: cat,
      value: categoryCounts[cat],
      color: categoryColors[cat] || "#64748b",
    }));

    if (categoryDistribution.length === 0) {
      categoryDistribution = [
        { name: "Unsafe Condition (KTA)", value: ktaCount, color: "#e95623" },
        { name: "Unsafe Action (TTA)", value: ttaCount, color: "#f59e0b" },
      ];
    }

    // Risk distribution
    const riskCounts: Record<string, number> = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    };
    records.forEach((r: any) => {
      const rk = String(r.riskLevel || "").trim();
      if (rk.toLowerCase() === "critical") riskCounts.Critical++;
      else if (rk.toLowerCase() === "high") riskCounts.High++;
      else if (rk.toLowerCase() === "low") riskCounts.Low++;
      else riskCounts.Medium++;
    });

    const riskDistribution = [
      { name: "Critical", value: riskCounts.Critical, color: "#dc2626" },
      { name: "High", value: riskCounts.High, color: "#ea580c" },
      { name: "Medium", value: riskCounts.Medium, color: "#f59e0b" },
      { name: "Low", value: riskCounts.Low, color: "#10b981" },
    ];

    // Location distribution
    const locCounts: Record<string, number> = {};
    records.forEach((r: any) => {
      const loc = r.lokasiBahaya || "WORKSHOP";
      locCounts[loc] = (locCounts[loc] || 0) + 1;
    });
    const locationDistribution = Object.keys(locCounts)
      .map((k) => ({ name: k, count: locCounts[k] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    res.json({
      success: true,
      data: {
        safeManHours: 1285400,
        daysWithoutLti: 435,
        ltifr: 0.0,
        trifr: 0.0,
        totalHazards,
        openHazards,
        inProgressHazards,
        closedHazards,
        ktaCount,
        ttaCount,
        nearMissCount: 0,
        resolutionRate,
        monthlyTrends,
        weeklyTrends,
        inspectionsSummary: {
          totalInspections,
          compliantInspections,
          needFollowUpInspections,
          shift1Inspections,
          shift2Inspections,
          avgScoreInspections,
        },
        observationsSummary: {
          totalObservations,
          safeObservations,
          riskyObservations,
          safeRatePct,
        },
        categoryDistribution,
        riskDistribution,
        locationDistribution,
      },
    });
  } catch (err: any) {
    console.error("Error fetching SHE dashboard:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to fetch dashboard data" });
  }
};

export const createHazard = async (req: Request, res: Response) => {
  try {
    const data = req.body;

    const dokSebelum = data.dokumentasiSebelum || data.photoUrl;
    if (!dokSebelum || !String(dokSebelum).trim()) {
      return res.status(400).json({
        success: false,
        error: "Dokumentasi Sebelum (Foto Temuan) wajib diisi / diunggah.",
      });
    }

    const jobSite = data.jobSite === "Senyiur" ? "Senyiur" : "MuaraPahu";
    const sitePrefix = jobSite === "MuaraPahu" ? "MP" : "SY";
    const year = new Date().getFullYear();

    // Generate unique sequential reportNumber
    const count = await (prisma as any).hazardReport.count({
      where: { jobSite },
    });
    const reportNumber = data.reportNumber || `HZ-${sitePrefix}-${year}-${String(count + 1).padStart(4, "0")}`;

    const dateVal = data.date || data.tanggalPelaporan ? new Date(data.date || data.tanggalPelaporan) : new Date();

    const created = await (prisma as any).hazardReport.create({
      data: {
        reportNumber,
        date: dateVal,
        time: data.time || "08:00",
        jobSite,
        project: data.project || (jobSite === "MuaraPahu" ? "MUARA PAHU" : "SENYIUR"),
        location: data.location || data.lokasiBahaya || "WORKSHOP",
        category: data.category || (data.jenisPelaporan === "TTA" ? "Unsafe Action" : "Unsafe Condition"),
        riskLevel: data.riskLevel || "Medium",
        title: data.title || data.identifikasiBahaya || "Temuan Bahaya K3L",
        description: data.description || data.rincianBahaya || null,
        immediateAction: data.immediateAction || null,
        correctiveAction: data.correctiveAction || data.tindakanPerbaikan || null,
        reporterName: data.reporterName || data.namaPelapor || "Karyawan",
        reporterNrp: data.reporterNrp || data.nrpPelapor || null,
        reporterDept: data.reporterDept || data.departemenPelapor || "PLANT",
        reporterJobTitle: data.reporterJobTitle || data.jabatanPelapor || null,
        picName: data.picName || data.penanggungJawabArea || "PLANT",
        picDept: data.picDept || data.penanggungJawabArea || "PLANT",
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        completionDate: data.completionDate ? new Date(data.completionDate) : null,
        status: data.status || (data.statusGForm === "CLOSE" ? "Closed" : "Open"),
        statusGForm: data.statusGForm || (data.status === "Closed" ? "CLOSE" : "OPEN"),
        jenisPelaporan: data.jenisPelaporan || "KTA",
        lokasiBahaya: data.lokasiBahaya || data.location || "WORKSHOP",
        identifikasiBahaya: data.identifikasiBahaya || data.title || null,
        rincianBahaya: data.rincianBahaya || data.description || null,
        tindakanPerbaikan: data.tindakanPerbaikan || data.correctiveAction || null,
        penanggungJawabArea: data.penanggungJawabArea || data.picDept || "PLANT",
        dokumentasiSebelum: data.dokumentasiSebelum || data.photoUrl || null,
        dokumentasiSesudah: data.dokumentasiSesudah || data.evidenceUrl || null,
        month: dateVal.getMonth() + 1,
      },
    });

    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    console.error("Error creating hazard report:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to create hazard report" });
  }
};

export const updateHazard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updates: any = {};
    if (data.statusGForm !== undefined) updates.statusGForm = data.statusGForm;
    if (data.status !== undefined) updates.status = data.status;
    if (data.tindakanPerbaikan !== undefined) updates.tindakanPerbaikan = data.tindakanPerbaikan;
    if (data.correctiveAction !== undefined) updates.correctiveAction = data.correctiveAction;
    if (data.dokumentasiSesudah !== undefined) updates.dokumentasiSesudah = data.dokumentasiSesudah;
    if (data.completionDate !== undefined) updates.completionDate = data.completionDate ? new Date(data.completionDate) : null;
    if (data.riskLevel !== undefined) updates.riskLevel = data.riskLevel;
    if (data.penanggungJawabArea !== undefined) updates.penanggungJawabArea = data.penanggungJawabArea;

    const updated = await (prisma as any).hazardReport.update({
      where: { id },
      data: updates,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("Error updating hazard report:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to update hazard report" });
  }
};

export const deleteHazard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await (prisma as any).hazardReport.delete({
      where: { id },
    });
    res.json({ success: true, message: "Hazard report deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting hazard report:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to delete hazard report" });
  }
};

// ==========================================
// WORK AREA INSPECTION CONTROLLERS
// ==========================================

export const getInspections = async (req: Request, res: Response) => {
  try {
    const { site, search, location, shift, status, limit, offset } = req.query;

    const where: any = {};

    // Site filtering
    if (site && site !== "ALL") {
      const siteStr = String(site).replace(/[\s_-]+/g, "").toUpperCase();
      if (siteStr.includes("MUARA") || siteStr.includes("PAHU") || siteStr === "MP") {
        where.jobSite = "MuaraPahu";
      } else if (siteStr.includes("SENYIUR") || siteStr === "SY") {
        where.jobSite = "Senyiur";
      } else if (site === "MuaraPahu" || site === "Senyiur") {
        where.jobSite = site;
      }
    }

    // Location filtering
    if (location && location !== "ALL") {
      where.lokasiInspeksi = String(location).trim().toUpperCase();
    }

    // Shift filtering
    if (shift && shift !== "ALL") {
      where.shift = String(shift).trim().toUpperCase();
    }

    // Status filtering
    if (status && status !== "ALL") {
      where.status = String(status).trim();
    }

    // Search query
    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { inspectionNumber: { contains: q, mode: "insensitive" } },
        { namaKaryawan: { contains: q, mode: "insensitive" } },
        { nikKaryawan: { contains: q, mode: "insensitive" } },
        { lokasiInspeksi: { contains: q, mode: "insensitive" } },
        { areaName: { contains: q, mode: "insensitive" } },
        { findingsDescription: { contains: q, mode: "insensitive" } },
        { pic: { contains: q, mode: "insensitive" } },
      ];
    }

    const take = limit ? Math.min(Math.max(Number(limit), 1), 5000) : 5000;
    const skip = offset ? Math.max(Number(offset), 0) : 0;

    const [total, records] = await Promise.all([
      (prisma as any).workAreaInspection.count({ where }),
      (prisma as any).workAreaInspection.findMany({
        where,
        orderBy: [{ tanggalInspeksi: "desc" }, { createdAt: "desc" }],
        take,
        skip,
      }),
    ]);

    const formatted = records.map((r: any) => ({
      id: r.id,
      inspectionNumber: r.inspectionNumber,
      namaKaryawan: r.namaKaryawan,
      nikKaryawan: r.nikKaryawan,
      tanggalInspeksi: r.tanggalInspeksi ? new Date(r.tanggalInspeksi).toISOString().slice(0, 10) : "",
      lokasiInspeksi: r.lokasiInspeksi,
      shift: r.shift,
      project: r.project,
      jobSite: r.jobSite,
      areaName: r.areaName || `${r.lokasiInspeksi} ${r.project}`,
      time: r.time || "08:00",
      complianceScore: Number(r.complianceScore) || 100,
      status: r.status || "Compliant",
      findingsCount: Number(r.findingsCount) || 0,
      findingsDescription: r.findingsDescription || undefined,
      correctiveAction: r.correctiveAction || undefined,
      pic: r.pic || undefined,
      targetCompletionDate: r.targetCompletionDate ? new Date(r.targetCompletionDate).toISOString().slice(0, 10) : undefined,
      lokasiOilTrap: r.lokasiOilTrap || undefined,
      oilTrapAnswers: r.oilTrapAnswersJson ? JSON.parse(r.oilTrapAnswersJson) : undefined,
      dokumentasiInspeksi: r.dokumentasiInspeksi || undefined,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    }));

    res.json({
      success: true,
      total,
      data: formatted,
    });
  } catch (err: any) {
    console.error("Error fetching work area inspections:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to fetch work area inspections" });
  }
};

export const createInspection = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const jobSite = data.project === "SENYIUR" || data.jobSite === "Senyiur" ? "Senyiur" : "MuaraPahu";
    const sitePrefix = jobSite === "MuaraPahu" ? "MP" : "SN";
    const year = new Date().getFullYear();

    const count = await (prisma as any).workAreaInspection.count({
      where: { jobSite },
    });
    const inspectionNumber = data.inspectionNumber || `INS-${sitePrefix}-${year}-${String(count + 1).padStart(4, "0")}`;

    const dateVal = data.tanggalInspeksi ? new Date(data.tanggalInspeksi) : new Date();

    const created = await (prisma as any).workAreaInspection.create({
      data: {
        inspectionNumber,
        namaKaryawan: data.namaKaryawan,
        nikKaryawan: data.nikKaryawan,
        tanggalInspeksi: dateVal,
        lokasiInspeksi: data.lokasiInspeksi || "WORKSHOP",
        shift: data.shift || "SHIFT 1",
        project: data.project || (jobSite === "MuaraPahu" ? "MUARA PAHU" : "SENYIUR"),
        jobSite,
        areaName: data.areaName || `${data.lokasiInspeksi || "WORKSHOP"} ${jobSite}`,
        time: data.time || "08:00",
        complianceScore: Number(data.complianceScore) || 100,
        status: data.status || "Compliant",
        findingsCount: Number(data.findingsCount) || 0,
        findingsDescription: data.findingsDescription || null,
        correctiveAction: data.correctiveAction || null,
        pic: data.pic || null,
        targetCompletionDate: data.targetCompletionDate ? new Date(data.targetCompletionDate) : null,
        lokasiOilTrap: data.lokasiOilTrap || null,
        oilTrapAnswersJson: data.oilTrapAnswers ? JSON.stringify(data.oilTrapAnswers) : null,
        dokumentasiInspeksi: data.dokumentasiInspeksi || null,
        month: dateVal.getMonth() + 1,
      },
    });

    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    console.error("Error creating work area inspection:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to create inspection" });
  }
};

export const updateInspection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updates: any = {};
    if (data.status !== undefined) updates.status = data.status;
    if (data.complianceScore !== undefined) updates.complianceScore = Number(data.complianceScore);
    if (data.findingsCount !== undefined) updates.findingsCount = Number(data.findingsCount);
    if (data.findingsDescription !== undefined) updates.findingsDescription = data.findingsDescription;
    if (data.correctiveAction !== undefined) updates.correctiveAction = data.correctiveAction;
    if (data.pic !== undefined) updates.pic = data.pic;
    if (data.targetCompletionDate !== undefined) updates.targetCompletionDate = data.targetCompletionDate ? new Date(data.targetCompletionDate) : null;

    const updated = await (prisma as any).workAreaInspection.update({
      where: { id },
      data: updates,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("Error updating work area inspection:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to update inspection" });
  }
};

export const deleteInspection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await (prisma as any).workAreaInspection.delete({
      where: { id },
    });
    res.json({ success: true, message: "Work area inspection deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting work area inspection:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to delete inspection" });
  }
};

// ==========================================
// SAFETY OBSERVATION CONTROLLERS
// ==========================================

export const getObservations = async (req: Request, res: Response) => {
  try {
    const { site, search, status, location, limit, offset } = req.query;

    const where: any = {};

    if (site && site !== "ALL") {
      const siteStr = String(site).replace(/[\s_-]+/g, "").toUpperCase();
      if (siteStr.includes("MUARA") || siteStr.includes("PAHU") || siteStr === "MP") {
        where.jobSite = "MuaraPahu";
      } else if (siteStr.includes("SENYIUR") || siteStr === "SY") {
        where.jobSite = "Senyiur";
      } else if (site === "MuaraPahu" || site === "Senyiur") {
        where.jobSite = site;
      }
    }

    if (status && status !== "ALL") {
      where.status = String(status).toUpperCase() === "BERISIKO" ? "BERISIKO" : "AMAN";
    }

    if (location && location !== "ALL") {
      where.lokasiObservasi = { contains: String(location), mode: "insensitive" };
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { observationNumber: { contains: q, mode: "insensitive" } },
        { judulObservasi: { contains: q, mode: "insensitive" } },
        { namaObserver: { contains: q, mode: "insensitive" } },
        { nikObserver: { contains: q, mode: "insensitive" } },
        { namaObserved: { contains: q, mode: "insensitive" } },
        { lokasiObservasi: { contains: q, mode: "insensitive" } },
        { detailLokasi: { contains: q, mode: "insensitive" } },
        { penanggungJawabArea: { contains: q, mode: "insensitive" } },
        { catatanObservasi: { contains: q, mode: "insensitive" } },
      ];
    }

    const take = limit ? Math.min(Math.max(Number(limit), 1), 2000) : 2000;
    const skip = offset ? Math.max(Number(offset), 0) : 0;

    const [total, records] = await Promise.all([
      (prisma as any).safetyObservation.count({ where }),
      (prisma as any).safetyObservation.findMany({
        where,
        orderBy: [{ tanggalObservasi: "desc" }, { createdAt: "desc" }],
        take,
        skip,
      }),
    ]);

    const formatted = records.map((r: any) => ({
      id: r.id,
      observationNumber: r.observationNumber,
      judulObservasi: r.judulObservasi,
      namaObserver: r.namaObserver,
      nikObserver: r.nikObserver || "",
      namaObserved: r.namaObserved,
      tanggalObservasi: r.tanggalObservasi ? new Date(r.tanggalObservasi).toISOString().slice(0, 10) : "",
      lokasiObservasi: r.lokasiObservasi,
      detailLokasi: r.detailLokasi || "",
      penanggungJawabArea: r.penanggungJawabArea || "PLANT",
      project: r.project,
      jobSite: r.jobSite,
      perubahanPosisi: r.perubahanPosisi || "AMAN",
      penghentianPekerjaan: r.penghentianPekerjaan || "AMAN",
      penggantianTool: r.penggantianTool || "AMAN",
      reaksiPekerjaCustom: r.reaksiPekerjaCustom || undefined,
      status: r.status || "AMAN",
      statusGForm: r.statusGForm || "OPEN",
      catatanObservasi: r.catatanObservasi || "",
      tindakanPerbaikan: r.tindakanPerbaikan || "",
      dokumentasi: r.dokumentasi || undefined,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    }));

    res.json({
      success: true,
      total,
      data: formatted,
    });
  } catch (err: any) {
    console.error("Error fetching safety observations:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to fetch observations" });
  }
};

export const createObservation = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const jobSite = data.project === "SENYIUR" || data.jobSite === "Senyiur" ? "Senyiur" : "MuaraPahu";
    const sitePrefix = jobSite === "MuaraPahu" ? "MP" : "SN";
    const year = new Date().getFullYear();

    const count = await (prisma as any).safetyObservation.count({
      where: { jobSite },
    });
    const observationNumber = data.observationNumber || `OBS-${sitePrefix}-${year}-${String(count + 1).padStart(4, "0")}`;

    const dateVal = data.tanggalObservasi ? new Date(data.tanggalObservasi) : new Date();

    const isRisky =
      String(data.perubahanPosisi).toUpperCase().includes("BERISIKO") ||
      String(data.penghentianPekerjaan).toUpperCase().includes("BERISIKO") ||
      String(data.penggantianTool).toUpperCase().includes("BERISIKO");

    const status = data.status || (isRisky ? "BERISIKO" : "AMAN");

    const created = await (prisma as any).safetyObservation.create({
      data: {
        observationNumber,
        judulObservasi: data.judulObservasi || "Observasi Perilaku Kerja",
        namaObserver: data.namaObserver || "Karyawan",
        nikObserver: data.nikObserver || null,
        namaObserved: data.namaObserved || "Pekerja Lapangan",
        tanggalObservasi: dateVal,
        lokasiObservasi: data.lokasiObservasi || "WORKSHOP",
        detailLokasi: data.detailLokasi || null,
        penanggungJawabArea: data.penanggungJawabArea || "PLANT",
        project: data.project || (jobSite === "MuaraPahu" ? "MUARA PAHU" : "SENYIUR"),
        jobSite,
        perubahanPosisi: data.perubahanPosisi || "AMAN",
        penghentianPekerjaan: data.penghentianPekerjaan || "AMAN",
        penggantianTool: data.penggantianTool || "AMAN",
        reaksiPekerjaCustom: data.reaksiPekerjaCustom || null,
        status,
        statusGForm: data.statusGForm || "OPEN",
        catatanObservasi: data.catatanObservasi || null,
        tindakanPerbaikan: data.tindakanPerbaikan || null,
        dokumentasi: data.dokumentasi || null,
        month: dateVal.getMonth() + 1,
      },
    });

    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    console.error("Error creating safety observation:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to create observation" });
  }
};

export const updateObservation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updates: any = {};
    if (data.status !== undefined) updates.status = data.status;
    if (data.statusGForm !== undefined) updates.statusGForm = data.statusGForm;
    if (data.catatanObservasi !== undefined) updates.catatanObservasi = data.catatanObservasi;
    if (data.tindakanPerbaikan !== undefined) updates.tindakanPerbaikan = data.tindakanPerbaikan;
    if (data.perubahanPosisi !== undefined) updates.perubahanPosisi = data.perubahanPosisi;
    if (data.penghentianPekerjaan !== undefined) updates.penghentianPekerjaan = data.penghentianPekerjaan;
    if (data.penggantianTool !== undefined) updates.penggantianTool = data.penggantianTool;
    if (data.dokumentasi !== undefined) updates.dokumentasi = data.dokumentasi;

    const updated = await (prisma as any).safetyObservation.update({
      where: { id },
      data: updates,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("Error updating safety observation:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to update observation" });
  }
};

export const deleteObservation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await (prisma as any).safetyObservation.delete({
      where: { id },
    });
    res.json({ success: true, message: "Safety observation deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting safety observation:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to delete observation" });
  }
};
