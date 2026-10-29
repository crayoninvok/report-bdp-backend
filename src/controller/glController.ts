import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { parseGLExcel } from "../lib/glParser";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

export const previewGLUpload = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File Excel GL (.xls / .xlsx) wajib diunggah.",
      });
    }

    const result = parseGLExcel(req.file.buffer, req.file.originalname);

    // Return metadata, summaries, site totals, and first 10 sample transactions for preview
    res.json({
      success: true,
      data: {
        fileName: result.fileName,
        periodName: result.periodName,
        startDate: result.startDate,
        endDate: result.endDate,
        year: result.year,
        month: result.month,
        totalDebet: result.totalDebet,
        totalCredit: result.totalCredit,
        totalTransactions: result.totalTransactions,
        siteTotals: result.siteTotals,
        reconciliationMatch: result.reconciliationMatch,
        discrepancy: result.discrepancy,
        summaries: result.summaries,
        sampleTransactions: result.transactions.slice(0, 10),
      },
    });
  } catch (error: any) {
    console.error("Error previewing GL upload:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Gagal memproses dan menganalisis file GL.",
    });
  }
};

export const commitGLUpload = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File Excel GL (.xls / .xlsx) wajib diunggah.",
      });
    }

    const parsed = parseGLExcel(req.file.buffer, req.file.originalname);

    // Run within a Prisma transaction
    const savedPeriod = await prisma.$transaction(async (tx) => {
      // Check if existing record exists for this year, month, and periodName
      const existing = await tx.gLPeriod.findFirst({
        where: {
          year: parsed.year,
          month: parsed.month,
          periodName: parsed.periodName,
        },
      });

      if (existing) {
        // Delete existing to replace with the fresh upload
        await tx.gLPeriod.delete({ where: { id: existing.id } });
      }

      // 1. Create GLPeriod
      const period = await tx.gLPeriod.create({
        data: {
          fileName: parsed.fileName,
          periodName: parsed.periodName,
          year: parsed.year,
          month: parsed.month,
          startDate: parsed.startDate ? new Date(parsed.startDate) : null,
          endDate: parsed.endDate ? new Date(parsed.endDate) : null,
          totalDebet: parsed.totalDebet,
          totalTransactions: parsed.totalTransactions,
        },
      });

      // 2. Batch insert summaries (Sheet2)
      if (parsed.summaries.length > 0) {
        await tx.gLExpenseSummary.createMany({
          data: parsed.summaries.map((s) => ({
            periodId: period.id,
            accountCode: s.accountCode,
            accountName: s.accountName,
            hofAmount: s.hofAmount,
            mphAmount: s.mphAmount,
            snyAmount: s.snyAmount,
            grandTotal: s.grandTotal,
          })),
        });
      }

      // 3. Batch insert transactions (Sheet1) in chunks of 1,000
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < parsed.transactions.length; i += CHUNK_SIZE) {
        const chunk = parsed.transactions.slice(i, i + CHUNK_SIZE);
        await tx.gLTransaction.createMany({
          data: chunk.map((t) => ({
            periodId: period.id,
            date: t.date,
            regNo: t.regNo,
            controlNo: t.controlNo,
            accountCode: t.accountCode,
            accountName: t.accountName,
            accountGroup: t.accountGroup,
            currency: t.currency,
            costCenter: t.costCenter,
            debet: t.debet,
            credit: t.credit,
            saldo: t.saldo,
            projectArea: t.projectArea,
            materialCode: t.materialCode,
            specification: t.specification,
            qty: t.qty,
            supplierName: t.supplierName,
            remark: t.remark,
          })),
        });
      }

      return period;
    });

    res.json({
      success: true,
      message: `Data GL periode ${parsed.periodName} berhasil disimpan (${parsed.totalTransactions.toLocaleString()} transaksi).`,
      data: {
        periodId: savedPeriod.id,
        periodName: savedPeriod.periodName,
        totalDebet: savedPeriod.totalDebet,
        totalTransactions: savedPeriod.totalTransactions,
      },
    });
  } catch (error: any) {
    console.error("Error committing GL upload:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Gagal menyimpan data GL ke database.",
    });
  }
};

export const getGLPeriods = async (req: Request, res: Response) => {
  try {
    const periods = await prisma.gLPeriod.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        fileName: true,
        periodName: true,
        year: true,
        month: true,
        startDate: true,
        endDate: true,
        totalDebet: true,
        totalTransactions: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: periods,
    });
  } catch (error: any) {
    console.error("Error getting GL periods:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil daftar periode GL." });
  }
};

export const getGLExpenseSummaries = async (req: Request, res: Response) => {
  try {
    let periodId = req.query.periodId as string;
    const search = req.query.search ? String(req.query.search).trim() : "";

    if (!periodId) {
      // Default to latest period
      const latest = await prisma.gLPeriod.findFirst({
        orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
      });
      if (!latest) {
        return res.json({ success: true, data: [], period: null });
      }
      periodId = latest.id;
    }

    const period = await prisma.gLPeriod.findUnique({
      where: { id: periodId },
      select: {
        id: true,
        fileName: true,
        periodName: true,
        year: true,
        month: true,
        startDate: true,
        endDate: true,
        totalDebet: true,
        totalTransactions: true,
      },
    });

    if (!period) {
      return res.status(404).json({ success: false, message: "Periode GL tidak ditemukan." });
    }

    const where: any = { periodId };
    if (search) {
      where.OR = [
        { accountCode: { contains: search, mode: "insensitive" } },
        { accountName: { contains: search, mode: "insensitive" } },
      ];
    }

    const summaries = await prisma.gLExpenseSummary.findMany({
      where,
      orderBy: { accountCode: "asc" },
    });

    // Calculate site subtotals from summaries
    let totalHof = 0;
    let totalMph = 0;
    let totalSny = 0;
    let grandTotal = 0;

    summaries.forEach((s) => {
      totalHof += s.hofAmount;
      totalMph += s.mphAmount;
      totalSny += s.snyAmount;
      grandTotal += (s.mphAmount + s.snyAmount);
    });

    res.json({
      success: true,
      period,
      totals: {
        HOF: totalHof,
        MPH: totalMph,
        SNY: totalSny,
        grandTotal,
      },
      data: summaries,
    });
  } catch (error: any) {
    console.error("Error getting GL expense summaries:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil ringkasan kode beban GL." });
  }
};

export const getGLTransactions = async (req: Request, res: Response) => {
  try {
    let periodId = req.query.periodId as string;
    const site = req.query.site ? String(req.query.site).trim().toUpperCase() : "";
    const accountCode = req.query.accountCode ? String(req.query.accountCode).trim() : "";
    const startDate = req.query.startDate ? String(req.query.startDate).trim() : "";
    const endDate = req.query.endDate ? String(req.query.endDate).trim() : "";
    const search = req.query.q ? String(req.query.q).trim() : "";
    const voucherType = req.query.voucherType ? String(req.query.voucherType).trim().toUpperCase() : "";
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(10000, Math.max(10, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;

    if (!periodId) {
      const latest = await prisma.gLPeriod.findFirst({
        orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
      });
      if (!latest) {
        return res.json({
          success: true,
          data: [],
          period: null,
          pagination: { total: 0, page: 1, limit, totalPages: 0 },
        });
      }
      periodId = latest.id;
    }

    const where: any = { periodId };

    if (site && ["MPH", "SNY"].includes(site)) {
      where.projectArea = site;
    } else {
      where.projectArea = { in: ["MPH", "SNY"] };
    }

    if (accountCode) {
      where.accountCode = accountCode;
    }

    if (voucherType === "GI") {
      where.regNo = { startsWith: "GI" };
    } else if (voucherType === "WITH_QTY") {
      where.qty = { gt: 0 };
    }

    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    } else if (startDate) {
      where.date = { gte: startDate };
    } else if (endDate) {
      where.date = { lte: endDate };
    }

    if (search) {
      where.OR = [
        { regNo: { contains: search, mode: "insensitive" } },
        { controlNo: { contains: search, mode: "insensitive" } },
        { accountName: { contains: search, mode: "insensitive" } },
        { supplierName: { contains: search, mode: "insensitive" } },
        { remark: { contains: search, mode: "insensitive" } },
        { materialCode: { contains: search, mode: "insensitive" } },
        { specification: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, transactions] = await Promise.all([
      prisma.gLTransaction.count({ where }),
      prisma.gLTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: "desc" }, { id: "asc" }],
      }),
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error getting GL transactions:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil daftar transaksi GL." });
  }
};
