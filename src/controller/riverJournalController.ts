import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { JobSite } from "../generated/prisma/client";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * Helper to compute auto-description based on depth and threshold
 */
export function calculateAutoDescription(depth: number, minThreshold: number = 4.0): string {
  if (depth < minThreshold) {
    return "Surut (Tugboat Tidak Bisa Masuk)";
  }
  return "Air Sudah Aman";
}

/**
 * Helper to compute default conclusion
 */
export function calculateDefaultConclusion(depth: number, minThreshold: number = 4.0): string {
  if (depth < minThreshold) {
    return "Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai.";
  }
  return "Operasional Lancar";
}

/**
 * GET /api/river-journal
 * Fetch river journal records with optional filtering
 */
export const getRiverJournals = async (req: Request, res: Response) => {
  try {
    const { site, location, startDate, endDate, status, limit } = req.query;

    const where: any = {};

    if (site && typeof site === "string" && site !== "all") {
      where.site = site as JobSite;
    }

    if (location && typeof location === "string" && location !== "all") {
      where.location = { contains: location, mode: "insensitive" };
    }

    if (startDate && endDate) {
      where.date = {
        gte: String(startDate),
        lte: String(endDate),
      };
    } else if (startDate) {
      where.date = { gte: String(startDate) };
    } else if (endDate) {
      where.date = { lte: String(endDate) };
    }

    if (status && typeof status === "string") {
      if (status.toLowerCase() === "surut") {
        where.autoDescription = { contains: "Surut", mode: "insensitive" };
      } else if (status.toLowerCase() === "aman") {
        where.autoDescription = { contains: "Aman", mode: "insensitive" };
      }
    }

    const take = limit ? parseInt(limit as string, 10) : undefined;

    const journals = await prisma.riverJournal.findMany({
      where,
      orderBy: [{ date: "desc" }, { inputTime: "desc" }],
      take,
    });

    res.json({
      success: true,
      count: journals.length,
      data: journals,
    });
  } catch (error: any) {
    console.error("Error fetching river journals:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data River Journal",
      error: error.message,
    });
  }
};

/**
 * GET /api/river-journal/stats
 * Get KPI analytics for water levels
 */
export const getRiverJournalStats = async (req: Request, res: Response) => {
  try {
    const { site } = req.query;
    const where: any = {};

    if (site && typeof site === "string" && site !== "all") {
      where.site = site as JobSite;
    }

    const records = await prisma.riverJournal.findMany({
      where,
      orderBy: [{ date: "asc" }, { inputTime: "asc" }],
    });

    if (records.length === 0) {
      return res.json({
        success: true,
        data: {
          totalReadings: 0,
          latestReading: null,
          minDepth: 0,
          maxDepth: 0,
          avgDepth: 0,
          safeCount: 0,
          surutCount: 0,
          safePercentage: 0,
          currentStatus: "Unknown",
        },
      });
    }

    const depths = records.map((r) => r.waterDepth);
    const minDepth = Math.min(...depths);
    const maxDepth = Math.max(...depths);
    const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;

    const latest = records[records.length - 1];
    const previous = records.length > 1 ? records[records.length - 2] : null;
    const delta = previous ? Number((latest.waterDepth - previous.waterDepth).toFixed(2)) : 0;

    const safeCount = records.filter((r) => r.waterDepth >= r.minThreshold).length;
    const surutCount = records.length - safeCount;
    const safePercentage = Number(((safeCount / records.length) * 100).toFixed(1));

    res.json({
      success: true,
      data: {
        totalReadings: records.length,
        latestReading: {
          ...latest,
          delta,
        },
        minDepth: Number(minDepth.toFixed(2)),
        maxDepth: Number(maxDepth.toFixed(2)),
        avgDepth: Number(avgDepth.toFixed(2)),
        safeCount,
        surutCount,
        safePercentage,
        currentStatus: latest.waterDepth >= latest.minThreshold ? "Aman" : "Surut",
      },
    });
  } catch (error: any) {
    console.error("Error fetching river stats:", error);
    res.status(500).json({
      success: false,
      message: "Gagal menghitung statistik kedalaman sungai",
      error: error.message,
    });
  }
};

/**
 * POST /api/river-journal
 * Insert new river journal measurement via web
 */
export const createRiverJournal = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const {
      externalId,
      date,
      inputTime,
      location,
      site,
      waterDepth,
      minThreshold = 4.0,
      autoDescription,
      userInput,
      conclusion,
    } = req.body;

    if (!date || !inputTime || !location || !site || waterDepth === undefined) {
      return res.status(400).json({
        success: false,
        message: "Field wajib: date, inputTime, location, site, waterDepth harus diisi!",
      });
    }

    const parsedDepth = parseFloat(String(waterDepth).replace(",", "."));
    const parsedMinThreshold = parseFloat(String(minThreshold).replace(",", ".")) || 4.0;

    if (isNaN(parsedDepth)) {
      return res.status(400).json({
        success: false,
        message: "Format angka kedalaman sungai tidak valid!",
      });
    }

    const resolvedAutoDescription =
      autoDescription && autoDescription.trim() !== ""
        ? autoDescription
        : calculateAutoDescription(parsedDepth, parsedMinThreshold);

    const resolvedUserInput =
      userInput && userInput.trim() !== ""
        ? userInput
        : user?.email?.split("@")[0] || "Petugas Lapangan";

    const resolvedConclusion =
      conclusion && conclusion.trim() !== ""
        ? conclusion
        : calculateDefaultConclusion(parsedDepth, parsedMinThreshold);

    // Auto calculate next sequential externalId for the site if not provided
    let resolvedExternalId = externalId ? parseInt(String(externalId), 10) : undefined;
    if (!resolvedExternalId) {
      const highestExternal = await prisma.riverJournal.findFirst({
        where: { site: site as JobSite },
        orderBy: { externalId: "desc" },
        select: { externalId: true },
      });
      resolvedExternalId = (highestExternal?.externalId || 0) + 1;
    }

    const newRecord = await prisma.riverJournal.create({
      data: {
        externalId: resolvedExternalId,
        date: String(date),
        inputTime: String(inputTime),
        location: String(location),
        site: site as JobSite,
        waterDepth: parsedDepth,
        minThreshold: parsedMinThreshold,
        autoDescription: resolvedAutoDescription,
        userInput: resolvedUserInput,
        conclusion: resolvedConclusion,
      },
    });

    res.status(201).json({
      success: true,
      message: "Data kedalaman air sungai berhasil ditambahkan!",
      data: newRecord,
    });
  } catch (error: any) {
    console.error("Error creating river journal:", error);
    res.status(500).json({
      success: false,
      message: "Gagal menyimpan data kedalaman sungai",
      error: error.message,
    });
  }
};

/**
 * PUT /api/river-journal/:id
 * Update river journal measurement
 */
export const updateRiverJournal = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const {
      date,
      inputTime,
      location,
      site,
      waterDepth,
      minThreshold,
      autoDescription,
      userInput,
      conclusion,
    } = req.body;

    const existing = await prisma.riverJournal.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Data pengukuran tidak ditemukan!",
      });
    }

    const parsedDepth =
      waterDepth !== undefined
        ? parseFloat(String(waterDepth).replace(",", "."))
        : existing.waterDepth;

    const parsedThreshold =
      minThreshold !== undefined
        ? parseFloat(String(minThreshold).replace(",", "."))
        : existing.minThreshold;

    const resolvedAutoDescription =
      autoDescription !== undefined
        ? autoDescription
        : calculateAutoDescription(parsedDepth, parsedThreshold);

    const updated = await prisma.riverJournal.update({
      where: { id },
      data: {
        ...(date && { date: String(date) }),
        ...(inputTime && { inputTime: String(inputTime) }),
        ...(location && { location: String(location) }),
        ...(site && { site: site as JobSite }),
        waterDepth: parsedDepth,
        minThreshold: parsedThreshold,
        autoDescription: resolvedAutoDescription,
        ...(userInput && { userInput: String(userInput) }),
        ...(conclusion && { conclusion: String(conclusion) }),
      },
    });

    res.json({
      success: true,
      message: "Data kedalaman sungai berhasil diperbarui!",
      data: updated,
    });
  } catch (error: any) {
    console.error("Error updating river journal:", error);
    res.status(500).json({
      success: false,
      message: "Gagal memperbarui data kedalaman sungai",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/river-journal/:id
 * Delete river journal measurement
 */
export const deleteRiverJournal = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    const existing = await prisma.riverJournal.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Data pengukuran tidak ditemukan!",
      });
    }

    await prisma.riverJournal.delete({ where: { id } });

    res.json({
      success: true,
      message: "Data kedalaman sungai berhasil dihapus!",
    });
  } catch (error: any) {
    console.error("Error deleting river journal:", error);
    res.status(500).json({
      success: false,
      message: "Gagal menghapus data kedalaman sungai",
      error: error.message,
    });
  }
};
