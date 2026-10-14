import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  STANDARD_ACCOUNTS,
  ACCOUNT_DEFINITIONS,
  PARENT_ACCOUNT_NAMES,
} from "../constants/accounts";
import { JobSite } from "../generated/prisma/client";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

export const getReports = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { jobSite, year } = req.query;

    const where: any = {};

    // Site security rule: Non-HeadOffice users can ONLY access their own site!
    if (user && user.role !== "SuperAdmin" && user.jobSite !== "HeadOffice") {
      if (jobSite && typeof jobSite === "string" && jobSite !== user.jobSite) {
        return res.status(403).json({
          success: false,
          message: `Akses Ditolak: Anda tidak memiliki akses ke data Site ${jobSite}. Hak akses Anda hanya untuk Site ${user.jobSite}!`,
        });
      }
      where.jobSite = user.jobSite;
    } else {
      if (jobSite && typeof jobSite === "string") {
        where.jobSite = jobSite as JobSite;
      }
    }

    if (year) {
      where.year = parseInt(year as string, 10);
    }

    const reports = await prisma.weeklyReport.findMany({
      where,
      orderBy: [{ year: "desc" }, { weekNumber: "desc" }],
      select: {
        id: true,
        jobSite: true,
        periodName: true,
        startDate: true,
        endDate: true,
        year: true,
        weekNumber: true,
        status: true,
        budgetProduksi: true,
        realisasiProduksi: true,
        updatedAt: true,
      },
    });

    res.json({ success: true, data: reports });
  } catch (error: any) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil daftar laporan" });
  }
};

export const getReportDetails = async (req: Request, res: Response) => {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const user = (req as AuthenticatedRequest).user;

    const report = await prisma.weeklyReport.findUnique({
      where: { id },
    });

    if (!report) {
      return res.status(404).json({ success: false, message: "Laporan tidak ditemukan" });
    }

    // Site security rule: Non-HeadOffice users cannot view reports of other sites
    if (user && user.role !== "SuperAdmin" && user.jobSite !== "HeadOffice") {
      if (report.jobSite !== user.jobSite) {
        return res.status(403).json({
          success: false,
          message: `Akses Ditolak: Anda tidak memiliki akses ke data laporan Site ${report.jobSite}. Hak akses Anda hanya untuk Site ${user.jobSite}!`,
        });
      }
    }

    // Fetch existing items for this report
    let items = await prisma.weeklyReportItem.findMany({
      where: { reportId: id },
      orderBy: { orderIndex: "asc" },
    });

    // Ensure all standard accounts exist in current report
    const defMap = new Map(ACCOUNT_DEFINITIONS.map((d) => [d.name, d]));
    const existingAccountNames = new Set(items.map((i) => i.accountName));
    const missingAccounts = STANDARD_ACCOUNTS.filter((acc) => !existingAccountNames.has(acc));

    if (missingAccounts.length > 0) {
      const itemsToInsert = missingAccounts.map((acc) => {
        const def = defMap.get(acc);
        return {
          reportId: report.id,
          accountCode: def?.accountCode || null,
          accountName: acc,
          costBehavior: def?.costBehavior || null,
          accountGroup: def?.accountGroup || null,
          subCategory: def?.subCategory || null,
          isParent: def ? def.isParent : true,
          parentName: def?.parentName || null,
          orderIndex: STANDARD_ACCOUNTS.indexOf(acc) + 1,
          budgetCost: 0,
          realisasiCost: 0,
        };
      });

      await prisma.weeklyReportItem.createMany({
        data: itemsToInsert,
      });

      // Re-fetch items after insertions
      items = await prisma.weeklyReportItem.findMany({
        where: { reportId: id },
        orderBy: { orderIndex: "asc" },
      });
    }

    // Fetch all historical weeks for the same site and year up to current weekNumber for accurate YTD
    const allWeeksYTD = await prisma.weeklyReport.findMany({
      where: {
        jobSite: report.jobSite,
        year: report.year,
        weekNumber: { lte: report.weekNumber },
      },
      orderBy: { weekNumber: "asc" },
    });

    const weekIds = allWeeksYTD.map((w) => w.id);
    const allItemsYTD = await prisma.weeklyReportItem.findMany({
      where: { reportId: { in: weekIds } },
    });

    // 1. Calculate Weekly Totals (only Parent accounts contribute to Total Biaya Produksi to avoid double counting)
    const weeklyBudgetProduksi = report.budgetProduksi || 0;
    const weeklyRealisasiProduksi = report.realisasiProduksi || 0;

    let weeklyTotalBiayaBudget = 0;
    let weeklyTotalBiayaRealisasi = 0;

    for (const item of items) {
      if (PARENT_ACCOUNT_NAMES.has(item.accountName)) {
        weeklyTotalBiayaBudget += item.budgetCost;
        weeklyTotalBiayaRealisasi += item.realisasiCost;
      }
    }

    // 2. Calculate YTD Totals
    let ytdBudgetProduksi = report.ytdBudgetProduksi ?? 0;
    let ytdRealisasiProduksi = report.ytdRealisasiProduksi ?? 0;

    if (ytdBudgetProduksi === 0 && ytdRealisasiProduksi === 0) {
      for (const w of allWeeksYTD) {
        ytdBudgetProduksi += w.budgetProduksi || 0;
        ytdRealisasiProduksi += w.realisasiProduksi || 0;
      }
    }

    const ytdAccountBudgetMap = new Map<string, number>();
    const ytdAccountRealisasiMap = new Map<string, number>();

    const hasExplicitItemYTD = items.some(
      (it) => it.ytdBudgetCost !== null && it.ytdBudgetCost !== undefined
    );

    if (hasExplicitItemYTD) {
      for (const it of items) {
        ytdAccountBudgetMap.set(it.accountName, it.ytdBudgetCost ?? 0);
        ytdAccountRealisasiMap.set(it.accountName, it.ytdRealisasiCost ?? 0);
      }
    } else {
      for (const it of allItemsYTD) {
        ytdAccountBudgetMap.set(
          it.accountName,
          (ytdAccountBudgetMap.get(it.accountName) || 0) + it.budgetCost
        );
        ytdAccountRealisasiMap.set(
          it.accountName,
          (ytdAccountRealisasiMap.get(it.accountName) || 0) + it.realisasiCost
        );
      }
    }

    let ytdTotalBiayaBudget = 0;
    let ytdTotalBiayaRealisasi = 0;
    for (const [accName, val] of ytdAccountBudgetMap) {
      if (PARENT_ACCOUNT_NAMES.has(accName)) {
        ytdTotalBiayaBudget += val;
      }
    }
    for (const [accName, val] of ytdAccountRealisasiMap) {
      if (PARENT_ACCOUNT_NAMES.has(accName)) {
        ytdTotalBiayaRealisasi += val;
      }
    }

    // 3. Build enriched items with formulas
    const enrichedItems = items.map((it) => {
      const def = defMap.get(it.accountName);
      const isParent = it.isParent ?? def?.isParent ?? true;
      const parentName = it.parentName || def?.parentName || null;
      const accountCode = it.accountCode || def?.accountCode || null;
      const costBehavior = it.costBehavior || def?.costBehavior || null;
      const accountGroup = it.accountGroup || def?.accountGroup || null;
      const subCategory = it.subCategory || def?.subCategory || null;

      // Weekly calculations
      const weeklyBudget = it.budgetCost;
      const weeklyPercentTCBudget =
        weeklyTotalBiayaBudget > 0 ? (weeklyBudget / weeklyTotalBiayaBudget) * 100 : 0;
      const weeklyIdrPerTonBudget =
        weeklyBudgetProduksi > 0 ? weeklyBudget / weeklyBudgetProduksi : 0;

      const weeklyRealisasi = it.realisasiCost;
      const weeklyPercentTCRealisasi =
        weeklyTotalBiayaRealisasi > 0
          ? (weeklyRealisasi / weeklyTotalBiayaRealisasi) * 100
          : 0;
      const weeklyIdrPerTonRealisasi =
        weeklyRealisasiProduksi > 0 ? weeklyRealisasi / weeklyRealisasiProduksi : 0;

      const weeklyCostUnderOverPerTon = weeklyIdrPerTonBudget - weeklyIdrPerTonRealisasi;
      const weeklyCostUnderOver = weeklyBudget - weeklyRealisasi;

      // YTD calculations
      const ytdBudget = ytdAccountBudgetMap.get(it.accountName) || 0;
      const ytdPercentTCBudget =
        ytdTotalBiayaBudget > 0 ? (ytdBudget / ytdTotalBiayaBudget) * 100 : 0;
      const ytdIdrPerTonBudget =
        ytdBudgetProduksi > 0 ? ytdBudget / ytdBudgetProduksi : 0;

      const ytdRealisasi = ytdAccountRealisasiMap.get(it.accountName) || 0;
      const ytdPercentTCRealisasi =
        ytdTotalBiayaRealisasi > 0
          ? (ytdRealisasi / ytdTotalBiayaRealisasi) * 100
          : 0;
      const ytdIdrPerTonRealisasi =
        ytdRealisasiProduksi > 0 ? ytdRealisasi / ytdRealisasiProduksi : 0;

      const ytdCostUnderOverPerTon = ytdIdrPerTonBudget - ytdIdrPerTonRealisasi;
      const ytdCostUnderOver = ytdBudget - ytdRealisasi;

      return {
        id: it.id,
        accountCode,
        accountName: it.accountName,
        costBehavior,
        accountGroup,
        subCategory,
        orderIndex: it.orderIndex,
        isParent,
        parentName,
        // Weekly
        weeklyBudget,
        weeklyPercentTCBudget,
        weeklyIdrPerTonBudget,
        weeklyRealisasi,
        weeklyPercentTCRealisasi,
        weeklyIdrPerTonRealisasi,
        weeklyCostUnderOverPerTon,
        weeklyCostUnderOver,
        // YTD
        ytdBudget,
        ytdPercentTCBudget,
        ytdIdrPerTonBudget,
        ytdRealisasi,
        ytdPercentTCRealisasi,
        ytdIdrPerTonRealisasi,
        ytdCostUnderOverPerTon,
        ytdCostUnderOver,
      };
    });

    // 4. Build Totals for BIAYA PRODUKSI
    const biayaProduksi = {
      // Weekly
      weeklyBudget: weeklyTotalBiayaBudget,
      weeklyPercentTCBudget: weeklyTotalBiayaBudget > 0 ? 100 : 0,
      weeklyIdrPerTonBudget:
        weeklyBudgetProduksi > 0 ? weeklyTotalBiayaBudget / weeklyBudgetProduksi : 0,
      weeklyRealisasi: weeklyTotalBiayaRealisasi,
      weeklyPercentTCRealisasi: weeklyTotalBiayaRealisasi > 0 ? 100 : 0,
      weeklyIdrPerTonRealisasi:
        weeklyRealisasiProduksi > 0
          ? weeklyTotalBiayaRealisasi / weeklyRealisasiProduksi
          : 0,
      weeklyCostUnderOverPerTon:
        (weeklyBudgetProduksi > 0 ? weeklyTotalBiayaBudget / weeklyBudgetProduksi : 0) -
        (weeklyRealisasiProduksi > 0
          ? weeklyTotalBiayaRealisasi / weeklyRealisasiProduksi
          : 0),
      weeklyCostUnderOver: weeklyTotalBiayaBudget - weeklyTotalBiayaRealisasi,
      // YTD
      ytdBudget: ytdTotalBiayaBudget,
      ytdPercentTCBudget: ytdTotalBiayaBudget > 0 ? 100 : 0,
      ytdIdrPerTonBudget:
        ytdBudgetProduksi > 0 ? ytdTotalBiayaBudget / ytdBudgetProduksi : 0,
      ytdRealisasi: ytdTotalBiayaRealisasi,
      ytdPercentTCRealisasi: ytdTotalBiayaRealisasi > 0 ? 100 : 0,
      ytdIdrPerTonRealisasi:
        ytdRealisasiProduksi > 0 ? ytdTotalBiayaRealisasi / ytdRealisasiProduksi : 0,
      ytdCostUnderOverPerTon:
        (ytdBudgetProduksi > 0 ? ytdTotalBiayaBudget / ytdBudgetProduksi : 0) -
        (ytdRealisasiProduksi > 0 ? ytdTotalBiayaRealisasi / ytdRealisasiProduksi : 0),
      ytdCostUnderOver: ytdTotalBiayaBudget - ytdTotalBiayaRealisasi,
    };

    // 5. Build PRODUKSI row
    const produksi = {
      weeklyBudget: weeklyBudgetProduksi,
      weeklyRealisasi: weeklyRealisasiProduksi,
      weeklyVariance: weeklyBudgetProduksi - weeklyRealisasiProduksi,
      weeklyPercent:
        weeklyBudgetProduksi > 0
          ? (weeklyRealisasiProduksi / weeklyBudgetProduksi) * 100
          : 0,
      ytdBudget: ytdBudgetProduksi,
      ytdRealisasi: ytdRealisasiProduksi,
      ytdVariance: ytdBudgetProduksi - ytdRealisasiProduksi,
      ytdPercent:
        ytdBudgetProduksi > 0 ? (ytdRealisasiProduksi / ytdBudgetProduksi) * 100 : 0,
    };

    res.json({
      success: true,
      data: {
        report: {
          id: report.id,
          jobSite: report.jobSite,
          periodName: report.periodName,
          startDate: report.startDate,
          endDate: report.endDate,
          year: report.year,
          weekNumber: report.weekNumber,
          status: report.status,
          updatedAt: report.updatedAt,
        },
        produksi,
        biayaProduksi,
        items: enrichedItems,
      },
    });
  } catch (error: any) {
    console.error("Error fetching report details:", error);
    res.status(500).json({ success: false, message: "Gagal memproses detail laporan" });
  }
};

export const createReport = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { jobSite, periodName, startDate, endDate, year, weekNumber } = req.body;

    if (!jobSite || !periodName || !startDate || !endDate || !year || !weekNumber) {
      return res.status(400).json({ success: false, message: "Semua kolom wajib diisi" });
    }

    // Site security rule: Site users can only create reports for their own site
    if (user && user.role !== "SuperAdmin" && user.jobSite !== "HeadOffice") {
      if (jobSite !== user.jobSite) {
        return res.status(403).json({
          success: false,
          message: `Akses Ditolak: Anda hanya diizinkan membuat laporan untuk Site ${user.jobSite}!`,
        });
      }
    }

    const existing = await prisma.weeklyReport.findUnique({
      where: {
        jobSite_year_weekNumber: {
          jobSite: jobSite as JobSite,
          year: parseInt(year, 10),
          weekNumber: parseInt(weekNumber, 10),
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Laporan untuk ${jobSite} Minggu ${weekNumber} Tahun ${year} sudah ada!`,
      });
    }

    const report = await prisma.weeklyReport.create({
      data: {
        jobSite: jobSite as JobSite,
        periodName,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        year: parseInt(year, 10),
        weekNumber: parseInt(weekNumber, 10),
        budgetProduksi: 0,
        realisasiProduksi: 0,
        status: "Active",
      },
    });

    // Create all 86 standard account items automatically
    const itemsToCreate = ACCOUNT_DEFINITIONS.map((def, idx) => ({
      reportId: report.id,
      accountCode: def.accountCode,
      accountName: def.name,
      costBehavior: def.costBehavior,
      accountGroup: def.accountGroup,
      subCategory: def.subCategory,
      isParent: def.isParent,
      parentName: def.parentName,
      orderIndex: idx + 1,
      budgetCost: 0,
      realisasiCost: 0,
    }));

    await prisma.weeklyReportItem.createMany({
      data: itemsToCreate,
    });

    res.status(201).json({
      success: true,
      message: "Periode laporan baru berhasil dibuat dengan 86 akun standar",
      data: report,
    });
  } catch (error: any) {
    console.error("Error creating report:", error);
    res.status(500).json({ success: false, message: "Gagal membuat periode laporan baru" });
  }
};

export const updateBudget = async (req: Request, res: Response) => {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const user = (req as AuthenticatedRequest).user;
    const { userRole, userJobSite, budgetProduksi, items } = req.body;

    const effectiveRole = user?.role || userRole;
    const effectiveJobSite = user?.jobSite || userJobSite;

    const report = await prisma.weeklyReport.findUnique({ where: { id } });
    if (!report) {
      return res.status(404).json({ success: false, message: "Laporan tidak ditemukan" });
    }

    // RULE: Site user can update budget for their own site. Head Office / SuperAdmin can update both sites.
    if (effectiveRole !== "SuperAdmin" && effectiveJobSite !== "HeadOffice") {
      if (report.jobSite !== effectiveJobSite) {
        return res.status(403).json({
          success: false,
          message: `Akses Ditolak: Anda hanya dapat menginput Budget untuk site ${effectiveJobSite}!`,
        });
      }
    }

    // Update weekly production budget
    await prisma.weeklyReport.update({
      where: { id },
      data: {
        budgetProduksi: typeof budgetProduksi === "number" ? budgetProduksi : 0,
      },
    });

    // Update account budget items
    if (Array.isArray(items)) {
      const defMap = new Map(ACCOUNT_DEFINITIONS.map((d) => [d.name, d]));
      for (const item of items) {
        if (item.accountName) {
          const def = defMap.get(item.accountName);
          await prisma.weeklyReportItem.upsert({
            where: {
              reportId_accountName: {
                reportId: id,
                accountName: item.accountName,
              },
            },
            update: {
              budgetCost: typeof item.budgetCost === "number" ? item.budgetCost : 0,
            },
            create: {
              reportId: id,
              accountCode: def?.accountCode || null,
              accountName: item.accountName,
              costBehavior: def?.costBehavior || null,
              accountGroup: def?.accountGroup || null,
              subCategory: def?.subCategory || null,
              isParent: def ? def.isParent : true,
              parentName: def?.parentName || null,
              budgetCost: typeof item.budgetCost === "number" ? item.budgetCost : 0,
              realisasiCost: 0,
              orderIndex: STANDARD_ACCOUNTS.indexOf(item.accountName as any) + 1 || 99,
            },
          });
        }
      }
    }

    res.json({ success: true, message: "Data Budget berhasil diperbarui" });
  } catch (error: any) {
    console.error("Error updating budget:", error);
    res.status(500).json({ success: false, message: "Gagal memperbarui data Budget" });
  }
};

export const updateRealisasi = async (req: Request, res: Response) => {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const user = (req as AuthenticatedRequest).user;
    const { userRole, userJobSite, realisasiProduksi, items } = req.body;

    const effectiveRole = user?.role || userRole;
    const effectiveJobSite = user?.jobSite || userJobSite;

    const report = await prisma.weeklyReport.findUnique({ where: { id } });
    if (!report) {
      return res.status(404).json({ success: false, message: "Laporan tidak ditemukan" });
    }

    // RULE: Site user can only update their own site realisasi (HeadOffice/SuperAdmin can also update if needed)
    if (effectiveRole !== "SuperAdmin" && effectiveJobSite !== "HeadOffice") {
      if (report.jobSite !== effectiveJobSite) {
        return res.status(403).json({
          success: false,
          message: `Akses Ditolak: Anda hanya dapat menginput Realisasi untuk site ${effectiveJobSite}!`,
        });
      }
    }

    // Update weekly production realisasi
    await prisma.weeklyReport.update({
      where: { id },
      data: {
        realisasiProduksi: typeof realisasiProduksi === "number" ? realisasiProduksi : 0,
      },
    });

    // Update account realisasi items
    if (Array.isArray(items)) {
      const defMap = new Map(ACCOUNT_DEFINITIONS.map((d) => [d.name, d]));
      for (const item of items) {
        if (item.accountName) {
          const def = defMap.get(item.accountName);
          await prisma.weeklyReportItem.upsert({
            where: {
              reportId_accountName: {
                reportId: id,
                accountName: item.accountName,
              },
            },
            update: {
              realisasiCost:
                typeof item.realisasiCost === "number" ? item.realisasiCost : 0,
            },
            create: {
              reportId: id,
              accountCode: def?.accountCode || null,
              accountName: item.accountName,
              costBehavior: def?.costBehavior || null,
              accountGroup: def?.accountGroup || null,
              subCategory: def?.subCategory || null,
              isParent: def ? def.isParent : true,
              parentName: def?.parentName || null,
              realisasiCost:
                typeof item.realisasiCost === "number" ? item.realisasiCost : 0,
              budgetCost: 0,
              orderIndex: STANDARD_ACCOUNTS.indexOf(item.accountName as any) + 1 || 99,
            },
          });
        }
      }
    }

    res.json({
      success: true,
      message: `Data Realisasi berhasil diperbarui untuk Site ${report.jobSite}`,
    });
  } catch (error: any) {
    console.error("Error updating realisasi:", error);
    res.status(500).json({ success: false, message: "Gagal memperbarui data Realisasi" });
  }
};

export const getSummaryOps = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { jobSite, year } = req.query;
    const where: any = {};

    // Site security rule: Non-HeadOffice users can ONLY access summary data of their own site!
    if (user && user.role !== "SuperAdmin" && user.jobSite !== "HeadOffice") {
      if (jobSite && typeof jobSite === "string" && jobSite !== user.jobSite) {
        return res.status(403).json({
          success: false,
          message: `Akses Ditolak: Anda tidak memiliki akses ke summary data Site ${jobSite}. Hak akses Anda hanya untuk Site ${user.jobSite}!`,
        });
      }
      where.jobSite = user.jobSite;
    } else {
      if (jobSite && typeof jobSite === "string") {
        where.jobSite = jobSite as JobSite;
      }
    }

    if (year) {
      where.year = parseInt(year as string, 10);
    }

    const summaries = await prisma.pLSummaryOps.findMany({
      where,
      orderBy: [{ year: "asc" }, { month: "asc" }],
      include: {
        items: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    res.json({ success: true, data: summaries });
  } catch (error: any) {
    console.error("Error fetching summary ops:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil data summary ops" });
  }
};

export const deleteReport = async (req: Request, res: Response) => {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const user = (req as AuthenticatedRequest).user;

    // RULE: Only SuperAdmin can delete reports!
    if (user?.role !== "SuperAdmin") {
      return res.status(403).json({
        success: false,
        message: "Akses Ditolak: Hanya Super Admin yang memiliki wewenang untuk menghapus laporan!",
      });
    }

    const report = await prisma.weeklyReport.findUnique({ where: { id } });
    if (!report) {
      return res.status(404).json({ success: false, message: "Laporan tidak ditemukan" });
    }

    await prisma.weeklyReport.delete({ where: { id } });

    res.json({
      success: true,
      message: `Laporan periode ${report.periodName} (${report.jobSite}) berhasil dihapus.`,
    });
  } catch (error: any) {
    console.error("Error deleting report:", error);
    res.status(500).json({ success: false, message: "Gagal menghapus laporan" });
  }
};
