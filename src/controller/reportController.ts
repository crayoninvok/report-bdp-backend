import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  STANDARD_ACCOUNTS,
  ACCOUNT_DEFINITIONS,
  PARENT_ACCOUNT_NAMES,
} from "../constants/accounts";
import { JobSite } from "../generated/prisma/client";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { parseExcelReport, ParsedPeriodReport, MONTH_MAP } from "../lib/excelParser";
import { syncSummaryForMonth } from "../lib/syncSummary";

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

    // Khusus Muara Pahu: jika budget tidak ada pada Laporan PL, langsung tarik dari Laporan Summary dan taruh gelondongan di Laporan Cost
    if (report.jobSite === "MuaraPahu") {
      const hasBudget = items.some((it) => it.budgetCost > 0);
      if (!hasBudget) {
        let repMonth = new Date(report.endDate).getUTCMonth() + 1;
        if (report.periodName) {
          const match = report.periodName.match(/[A-Za-z]+/);
          if (match && MONTH_MAP[match[0].toLowerCase()]) {
            repMonth = MONTH_MAP[match[0].toLowerCase()];
          }
        }

        const summary = await prisma.pLSummaryOps.findFirst({
          where: {
            jobSite: "MuaraPahu",
            year: report.year,
            month: repMonth,
          },
          include: { items: true },
        });

        if (summary) {
          if ((report.budgetProduksi === 0 || !report.budgetProduksi) && summary.budgetProduksi > 0) {
            report.budgetProduksi = summary.budgetProduksi;
            await prisma.weeklyReport.update({
              where: { id: report.id },
              data: { budgetProduksi: summary.budgetProduksi },
            });
          }

          const nonZeroSummaryItems = summary.items.filter(
            (it) => it.budgetCost > 0 && it.accountName.trim().toUpperCase() !== "BIAYA PRODUKSI"
          );

          if (nonZeroSummaryItems.length > 0) {
            for (const sItem of nonZeroSummaryItems) {
              const cleanSummaryName = sItem.accountName.trim().toLowerCase();
              const targetItem = items.find(
                (it) => it.accountName.trim().toLowerCase() === cleanSummaryName
              );

              if (targetItem) {
                targetItem.budgetCost = sItem.budgetCost;
                await prisma.weeklyReportItem.update({
                  where: { id: targetItem.id },
                  data: { budgetCost: sItem.budgetCost },
                });
              }
            }
          }
        }
      }
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
        // MTD (Kumulatif Bulan)
        mtdBudget: it.mtdBudgetCost,
        mtdRealisasi: it.mtdRealisasiCost,
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
      // MTD
      mtdBudget: items.filter(it => PARENT_ACCOUNT_NAMES.has(it.accountName)).reduce((sum, it) => sum + (it.mtdBudgetCost ?? 0), 0) || null,
      mtdRealisasi: items.filter(it => PARENT_ACCOUNT_NAMES.has(it.accountName)).reduce((sum, it) => sum + (it.mtdRealisasiCost ?? 0), 0) || null,
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
      mtdBudget: report.mtdBudgetProduksi,
      mtdRealisasi: report.mtdRealisasiProduksi,
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
          mtdBudgetProduksi: report.mtdBudgetProduksi,
          mtdRealisasiProduksi: report.mtdRealisasiProduksi,
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

export const updatePeriod = async (req: Request, res: Response) => {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const user = (req as AuthenticatedRequest).user;
    const { periodName, weekNumber, year, startDate, endDate, budgetProduksi, realisasiProduksi } = req.body;

    const report = await prisma.weeklyReport.findUnique({ where: { id } });
    if (!report) {
      return res.status(404).json({ success: false, message: "Laporan tidak ditemukan" });
    }

    // Site security rule: Site users can only edit their own site's report
    if (user && user.role !== "SuperAdmin" && user.jobSite !== "HeadOffice") {
      if (report.jobSite !== user.jobSite) {
        return res.status(403).json({
          success: false,
          message: `Akses Ditolak: Anda hanya diizinkan mengedit periode untuk Site ${user.jobSite}!`,
        });
      }
    }

    const newWeekNumber = weekNumber !== undefined ? parseInt(weekNumber, 10) : report.weekNumber;
    const newYear = year !== undefined ? parseInt(year, 10) : report.year;

    // Check unique constraint [jobSite, year, weekNumber] if weekNumber or year changed
    if (newWeekNumber !== report.weekNumber || newYear !== report.year) {
      const existing = await prisma.weeklyReport.findUnique({
        where: {
          jobSite_year_weekNumber: {
            jobSite: report.jobSite,
            year: newYear,
            weekNumber: newWeekNumber,
          },
        },
      });
      if (existing && existing.id !== id) {
        return res.status(400).json({
          success: false,
          message: `Laporan untuk Site ${report.jobSite} Minggu ${newWeekNumber} Tahun ${newYear} sudah ada!`,
        });
      }
    }

    const updated = await prisma.weeklyReport.update({
      where: { id },
      data: {
        periodName: periodName ? String(periodName).trim() : report.periodName,
        weekNumber: newWeekNumber,
        year: newYear,
        startDate: startDate ? new Date(startDate) : report.startDate,
        endDate: endDate ? new Date(endDate) : report.endDate,
        budgetProduksi: budgetProduksi !== undefined ? parseFloat(budgetProduksi) : report.budgetProduksi,
        realisasiProduksi: realisasiProduksi !== undefined ? parseFloat(realisasiProduksi) : report.realisasiProduksi,
      },
    });

    // Automatically synchronize Month 10 in PLSummaryOps so summary table remains in sync
    await syncSummaryForMonth(report.jobSite, newYear, 10);

    res.json({
      success: true,
      message: `Informasi periode "${updated.periodName}" (W${updated.weekNumber}) berhasil diperbarui`,
      data: updated,
    });
  } catch (error: any) {
    console.error("Error updating period:", error);
    res.status(500).json({ success: false, message: "Gagal memperbarui informasi periode" });
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

    // Automatically synchronize Month 10 in PLSummaryOps
    await syncSummaryForMonth(report.jobSite, report.year, 10);

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

    // Automatically synchronize Month 10 in PLSummaryOps
    await syncSummaryForMonth(report.jobSite, report.year, 10);

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

export const getCostTrends = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { year, jobSite } = req.query;
    const targetYear = year ? parseInt(year as string, 10) : 2026;

    const where: any = { year: targetYear, weekNumber: { gte: 29 } };

    // Site security rule: Non-HeadOffice users can only fetch their own site
    if (user && user.role !== "SuperAdmin" && user.jobSite !== "HeadOffice") {
      where.jobSite = user.jobSite;
    } else if (jobSite && typeof jobSite === "string") {
      where.jobSite = jobSite as JobSite;
    }

    const reports = await prisma.weeklyReport.findMany({
      where,
      include: { items: true },
      orderBy: [{ year: "asc" }, { weekNumber: "asc" }],
    });

    const toMillions = (val: number) => Math.max(0, Math.round(val / 1e6));

    const buildRecordsForSite = (site: JobSite) => {
      const siteReports = reports.filter((r) => r.jobSite === site);
      return siteReports.map((r) => {
        const parentItems = r.items.filter((it) => PARENT_ACCOUNT_NAMES.has(it.accountName));
        const totalBInRp = parentItems.reduce((sum, it) => sum + Math.max(0, it.budgetCost), 0);
        const totalRInRp = parentItems.reduce((sum, it) => sum + Math.max(0, it.realisasiCost), 0);
        const totalB = toMillions(totalBInRp);
        const totalR = toMillions(totalRInRp);

        const getCat = (accName: string) => {
          const it = r.items.find((i) => i.accountName === accName);
          const b = toMillions(it ? Math.max(0, it.budgetCost) : 0);
          const rVal = toMillions(it ? Math.max(0, it.realisasiCost) : 0);
          return { budget: b, realisasi: rVal, deviasi: b - rVal };
        };

        const idrTonBudget = r.budgetProduksi > 0 ? Math.round(totalBInRp / r.budgetProduksi) : 0;
        const idrTonReal = r.realisasiProduksi > 0 ? Math.round(totalRInRp / r.realisasiProduksi) : 0;

        return {
          label: `W${r.weekNumber}`,
          total: { budget: totalB, realisasi: totalR, deviasi: totalB - totalR },
          comp: getCat("BEBAN COMPENSATION AND BENEFIT - SITE"),
          fuel: getCat("BEBAN FUEL - PRODUCTION"),
          tyre: getCat("BEBAN TYRE"),
          rep: getCat("BEBAN REPAIRS & MAINTENANCE"),
          ovh: getCat("BEBAN OVERHEAD COST - SITE"),
          produksi: {
            budget: Math.round(r.budgetProduksi || 0),
            realisasi: Math.round(r.realisasiProduksi || 0),
          },
          idrPerTon: {
            budget: idrTonBudget,
            realisasi: idrTonReal,
            deviasi: idrTonBudget - idrTonReal,
          },
        };
      });
    };

    const summaries = await prisma.pLSummaryOps.findMany({
      where: {
        year: targetYear,
        ...(where.jobSite ? { jobSite: where.jobSite } : {}),
      },
      include: { items: true },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });

    const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const buildMonthlyRecordsForSite = (site: JobSite) => {
      const siteSummaries = summaries.filter((s) => s.jobSite === site);
      if (siteSummaries.length === 0) return [];

      return siteSummaries.map((s) => {
        const bp = s.items.find(
          (it) => it.accountName.trim().toUpperCase() === "BIAYA PRODUKSI"
        );
        const bpCostB = bp ? bp.budgetCost : 0;
        const bpCostR = bp ? bp.realisasiCost : 0;
        const totalB = toMillions(bpCostB);
        const totalR = toMillions(bpCostR);

        const getCat = (accName: string) => {
          const it = s.items.find(
            (i) => i.accountName.trim().toUpperCase() === accName.toUpperCase()
          );
          const b = toMillions(it ? Math.max(0, it.budgetCost) : 0);
          const rVal = toMillions(it ? Math.max(0, it.realisasiCost) : 0);
          return { budget: b, realisasi: rVal, deviasi: b - rVal };
        };

        const idrTonBudget = s.budgetProduksi > 0
          ? Math.round(bpCostB / s.budgetProduksi)
          : (bp?.budgetIdrPerTon ? Math.round(bp.budgetIdrPerTon) : 0);
        const idrTonReal = s.realisasiProduksi > 0
          ? Math.round(bpCostR / s.realisasiProduksi)
          : (bp?.realisasiIdrPerTon ? Math.round(bp.realisasiIdrPerTon) : 0);

        const label = s.monthLabel || MONTH_LABELS[s.month - 1] || `M${s.month}`;

        return {
          label,
          total: { budget: totalB, realisasi: totalR, deviasi: totalB - totalR },
          comp: getCat("BEBAN COMPENSATION AND BENEFIT - SITE"),
          fuel: getCat("BEBAN FUEL - PRODUCTION"),
          tyre: getCat("BEBAN TYRE"),
          rep: getCat("BEBAN REPAIRS & MAINTENANCE"),
          ovh: getCat("BEBAN OVERHEAD COST - SITE"),
          produksi: {
            budget: Math.round(s.budgetProduksi || 0),
            realisasi: Math.round(s.realisasiProduksi || 0),
          },
          idrPerTon: {
            budget: idrTonBudget,
            realisasi: idrTonReal,
            deviasi: idrTonBudget - idrTonReal,
          },
        };
      });
    };

    res.json({
      success: true,
      data: {
        Senyiur: {
          weekly: buildRecordsForSite(JobSite.Senyiur),
          monthly: buildMonthlyRecordsForSite(JobSite.Senyiur),
        },
        MuaraPahu: {
          weekly: buildRecordsForSite(JobSite.MuaraPahu),
          monthly: buildMonthlyRecordsForSite(JobSite.MuaraPahu),
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching cost trends:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil data tren biaya" });
  }
};

export const getCostOverallDashboard = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { year, jobSite, minWeek, maxWeek } = req.query;
    const targetYear = year ? parseInt(year as string, 10) : 2026;

    const where: any = { year: targetYear, weekNumber: { gte: minWeek ? parseInt(minWeek as string, 10) : 29 } };
    if (maxWeek) {
      where.weekNumber = { ...where.weekNumber, lte: parseInt(maxWeek as string, 10) };
    }

    const requestedSite = (jobSite as string) || "Senyiur";
    if (user && user.role !== "SuperAdmin" && user.jobSite !== "HeadOffice") {
      where.jobSite = user.jobSite;
    } else if (requestedSite !== "ALL") {
      where.jobSite = requestedSite as JobSite;
    }

    const rawReports = await prisma.weeklyReport.findMany({
      where,
      include: { items: true },
      orderBy: [{ year: "asc" }, { weekNumber: "asc" }],
    });

    // Group or prepare reports per week
    let weekReports: {
      weekNumber: number;
      label: string;
      periodName: string;
      budgetProduksi: number;
      realisasiProduksi: number;
      itemsMap: Map<string, { budgetCost: number; realisasiCost: number; isParent: boolean; subCategory: string | null; parentName: string | null; accountCode: string | null }>;
    }[] = [];

    if (requestedSite === "ALL") {
      const weekMap = new Map<number, typeof weekReports[0]>();
      rawReports.forEach((r) => {
        if (!weekMap.has(r.weekNumber)) {
          weekMap.set(r.weekNumber, {
            weekNumber: r.weekNumber,
            label: `W${r.weekNumber}`,
            periodName: r.periodName,
            budgetProduksi: 0,
            realisasiProduksi: 0,
            itemsMap: new Map(),
          });
        }
        const wEntry = weekMap.get(r.weekNumber)!;
        wEntry.budgetProduksi += r.budgetProduksi || 0;
        wEntry.realisasiProduksi += r.realisasiProduksi || 0;
        r.items.forEach((it) => {
          if (!wEntry.itemsMap.has(it.accountName)) {
            wEntry.itemsMap.set(it.accountName, {
              budgetCost: 0,
              realisasiCost: 0,
              isParent: it.isParent,
              subCategory: it.subCategory,
              parentName: it.parentName,
              accountCode: it.accountCode,
            });
          }
          const itemVal = wEntry.itemsMap.get(it.accountName)!;
          itemVal.budgetCost += it.budgetCost || 0;
          itemVal.realisasiCost += it.realisasiCost || 0;
        });
      });
      weekReports = Array.from(weekMap.values()).sort((a, b) => a.weekNumber - b.weekNumber);
    } else {
      weekReports = rawReports.map((r) => {
        const itemsMap = new Map<string, { budgetCost: number; realisasiCost: number; isParent: boolean; subCategory: string | null; parentName: string | null; accountCode: string | null }>();
        r.items.forEach((it) => {
          itemsMap.set(it.accountName, {
            budgetCost: it.budgetCost || 0,
            realisasiCost: it.realisasiCost || 0,
            isParent: it.isParent,
            subCategory: it.subCategory,
            parentName: it.parentName,
            accountCode: it.accountCode,
          });
        });
        return {
          weekNumber: r.weekNumber,
          label: `W${r.weekNumber}`,
          periodName: r.periodName,
          budgetProduksi: r.budgetProduksi || 0,
          realisasiProduksi: r.realisasiProduksi || 0,
          itemsMap,
        };
      });
    }

    const availableWeeks = weekReports.map((w) => w.label);

    let totalBudgetProduksi = 0;
    let totalRealisasiProduksi = 0;
    weekReports.forEach((w) => {
      totalBudgetProduksi += w.budgetProduksi;
      totalRealisasiProduksi += w.realisasiProduksi;
    });

    const calcCostPerTon = (cost: number, tonnage: number) => {
      return tonnage > 0 ? Math.round(cost / tonnage) : 0;
    };

    // 1. SUMMARY TOTAL (Biaya Produksi)
    const summaryTimeline = weekReports.map((w) => {
      let bCost = 0;
      let rCost = 0;
      PARENT_ACCOUNT_NAMES.forEach((pName) => {
        const pItem = w.itemsMap.get(pName);
        if (pItem) {
          bCost += pItem.budgetCost;
          rCost += pItem.realisasiCost;
        }
      });
      const bTon = calcCostPerTon(bCost, w.budgetProduksi);
      const rTon = calcCostPerTon(rCost, w.realisasiProduksi);
      return {
        weekNumber: w.weekNumber,
        label: w.label,
        periodName: w.periodName,
        budgetCost: Math.round(bCost),
        realisasiCost: Math.round(rCost),
        deviasiCost: Math.round(bCost - rCost),
        prodBudget: Math.round(w.budgetProduksi),
        prodReal: Math.round(w.realisasiProduksi),
        budgetIdrPerTon: bTon,
        realisasiIdrPerTon: rTon,
        deviasiIdrPerTon: bTon - rTon,
      };
    });

    const sumTotalB = summaryTimeline.reduce((s, t) => s + t.budgetCost, 0);
    const sumTotalR = summaryTimeline.reduce((s, t) => s + t.realisasiCost, 0);
    const summaryTotal = {
      name: "TOTAL BIAYA PRODUKSI",
      totalBudget: sumTotalB,
      totalRealisasi: sumTotalR,
      totalDeviasi: sumTotalB - sumTotalR,
      avgBudgetIdrPerTon: calcCostPerTon(sumTotalB, totalBudgetProduksi),
      avgRealisasiIdrPerTon: calcCostPerTon(sumTotalR, totalRealisasiProduksi),
      avgDeviasiIdrPerTon: calcCostPerTon(sumTotalB, totalBudgetProduksi) - calcCostPerTon(sumTotalR, totalRealisasiProduksi),
      timeline: summaryTimeline,
    };

    // 2. PARENT CATEGORIES
    const parentCategories = Array.from(PARENT_ACCOUNT_NAMES).map((pName, idx) => {
      const childAccounts = ACCOUNT_DEFINITIONS.filter((a) => a.parentName === pName && !a.isParent);
      const subCats = Array.from(new Set(childAccounts.map((a) => a.subCategory).filter(Boolean))) as string[];

      const timeline = weekReports.map((w) => {
        const it = w.itemsMap.get(pName);
        const b = it ? it.budgetCost : 0;
        const rVal = it ? it.realisasiCost : 0;
        const bTon = calcCostPerTon(b, w.budgetProduksi);
        const rTon = calcCostPerTon(rVal, w.realisasiProduksi);
        return {
          weekNumber: w.weekNumber,
          label: w.label,
          periodName: w.periodName,
          budgetCost: Math.round(b),
          realisasiCost: Math.round(rVal),
          deviasiCost: Math.round(b - rVal),
          prodBudget: Math.round(w.budgetProduksi),
          prodReal: Math.round(w.realisasiProduksi),
          budgetIdrPerTon: bTon,
          realisasiIdrPerTon: rTon,
          deviasiIdrPerTon: bTon - rTon,
        };
      });

      const tB = timeline.reduce((s, t) => s + t.budgetCost, 0);
      const tR = timeline.reduce((s, t) => s + t.realisasiCost, 0);
      const avgBTon = calcCostPerTon(tB, totalBudgetProduksi);
      const avgRTon = calcCostPerTon(tR, totalRealisasiProduksi);

      return {
        id: `parent-${idx}`,
        name: pName,
        type: "parent" as const,
        subCategories: subCats,
        accountCount: childAccounts.length,
        totalBudget: tB,
        totalRealisasi: tR,
        totalDeviasi: tB - tR,
        avgBudgetIdrPerTon: avgBTon,
        avgRealisasiIdrPerTon: avgRTon,
        avgDeviasiIdrPerTon: avgBTon - avgRTon,
        timeline,
      };
    });

    // 3. SUB-CATEGORIES
    const subCatMap = new Map<string, { name: string; parentName: string; accountCodes: string[]; accountNames: string[] }>();
    ACCOUNT_DEFINITIONS.forEach((a) => {
      if (!a.isParent && a.subCategory) {
        const scKey = `${a.parentName || "OTHER"}::${a.subCategory}`;
        if (!subCatMap.has(scKey)) {
          subCatMap.set(scKey, {
            name: a.subCategory,
            parentName: a.parentName || "OTHER",
            accountCodes: [],
            accountNames: [],
          });
        }
        const entry = subCatMap.get(scKey)!;
        if (a.accountCode) entry.accountCodes.push(a.accountCode);
        entry.accountNames.push(a.name);
      }
    });

    const subCategories = Array.from(subCatMap.values()).map((sc, idx) => {
      const timeline = weekReports.map((w) => {
        let b = 0;
        let rVal = 0;
        sc.accountNames.forEach((accName) => {
          const it = w.itemsMap.get(accName);
          if (it) {
            b += it.budgetCost;
            rVal += it.realisasiCost;
          }
        });
        const bTon = calcCostPerTon(b, w.budgetProduksi);
        const rTon = calcCostPerTon(rVal, w.realisasiProduksi);
        return {
          weekNumber: w.weekNumber,
          label: w.label,
          periodName: w.periodName,
          budgetCost: Math.round(b),
          realisasiCost: Math.round(rVal),
          deviasiCost: Math.round(b - rVal),
          prodBudget: Math.round(w.budgetProduksi),
          prodReal: Math.round(w.realisasiProduksi),
          budgetIdrPerTon: bTon,
          realisasiIdrPerTon: rTon,
          deviasiIdrPerTon: bTon - rTon,
        };
      });

      const tB = timeline.reduce((s, t) => s + t.budgetCost, 0);
      const tR = timeline.reduce((s, t) => s + t.realisasiCost, 0);
      const avgBTon = calcCostPerTon(tB, totalBudgetProduksi);
      const avgRTon = calcCostPerTon(tR, totalRealisasiProduksi);

      return {
        id: `subcat-${idx}`,
        name: sc.name,
        type: "subcategory" as const,
        parentName: sc.parentName,
        accountCodes: sc.accountCodes,
        accountCount: sc.accountNames.length,
        totalBudget: tB,
        totalRealisasi: tR,
        totalDeviasi: tB - tR,
        avgBudgetIdrPerTon: avgBTon,
        avgRealisasiIdrPerTon: avgRTon,
        avgDeviasiIdrPerTon: avgBTon - avgRTon,
        timeline,
      };
    });

    // 4. INDIVIDUAL LEAF ACCOUNTS
    const leafDefs = ACCOUNT_DEFINITIONS.filter((a) => !a.isParent);
    const accounts = leafDefs.map((def, idx) => {
      const timeline = weekReports.map((w) => {
        const it = w.itemsMap.get(def.name);
        const b = it ? it.budgetCost : 0;
        const rVal = it ? it.realisasiCost : 0;
        const bTon = calcCostPerTon(b, w.budgetProduksi);
        const rTon = calcCostPerTon(rVal, w.realisasiProduksi);
        return {
          weekNumber: w.weekNumber,
          label: w.label,
          periodName: w.periodName,
          budgetCost: Math.round(b),
          realisasiCost: Math.round(rVal),
          deviasiCost: Math.round(b - rVal),
          prodBudget: Math.round(w.budgetProduksi),
          prodReal: Math.round(w.realisasiProduksi),
          budgetIdrPerTon: bTon,
          realisasiIdrPerTon: rTon,
          deviasiIdrPerTon: bTon - rTon,
        };
      });

      const tB = timeline.reduce((s, t) => s + t.budgetCost, 0);
      const tR = timeline.reduce((s, t) => s + t.realisasiCost, 0);
      const avgBTon = calcCostPerTon(tB, totalBudgetProduksi);
      const avgRTon = calcCostPerTon(tR, totalRealisasiProduksi);

      return {
        id: `acc-${def.accountCode || idx}`,
        name: def.name,
        accountCode: def.accountCode,
        accountName: def.name,
        type: "account" as const,
        parentName: def.parentName || "BEBAN LAINNYA",
        subCategory: def.subCategory || "Lainnya",
        costBehavior: def.costBehavior,
        totalBudget: tB,
        totalRealisasi: tR,
        totalDeviasi: tB - tR,
        avgBudgetIdrPerTon: avgBTon,
        avgRealisasiIdrPerTon: avgRTon,
        avgDeviasiIdrPerTon: avgBTon - avgRTon,
        timeline,
      };
    });

    const productionTimeline = weekReports.map((w) => ({
      weekNumber: w.weekNumber,
      label: w.label,
      periodName: w.periodName,
      budgetProduksi: Math.round(w.budgetProduksi),
      realisasiProduksi: Math.round(w.realisasiProduksi),
      deviasiProduksi: Math.round(w.realisasiProduksi - w.budgetProduksi),
    }));

    res.json({
      success: true,
      data: {
        site: requestedSite,
        year: targetYear,
        totalBudgetProduksi: Math.round(totalBudgetProduksi),
        totalRealisasiProduksi: Math.round(totalRealisasiProduksi),
        availableWeeks,
        productionTimeline,
        summaryTotal,
        parentCategories,
        subCategories,
        accounts,
      },
    });
  } catch (error: any) {
    console.error("getCostOverallDashboard error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil data Dashboard Cost Overall" });
  }
};

export const previewExcelUpload = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File Excel (.xlsx) wajib diunggah",
      });
    }

    let targetJobSite: JobSite | undefined = undefined;
    if (user && user.role !== "SuperAdmin" && user.jobSite !== "HeadOffice") {
      targetJobSite = user.jobSite as JobSite;
    } else if (req.body.targetJobSite) {
      targetJobSite = req.body.targetJobSite as JobSite;
    }

    const result = await parseExcelReport(
      req.file.buffer,
      req.file.originalname,
      targetJobSite
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error previewing excel upload:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Gagal memproses dan menganalisis file Excel",
    });
  }
};

export const commitExcelUpload = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    let reportsToCommit: ParsedPeriodReport[] = [];

    if (req.file) {
      let targetJobSite: JobSite | undefined = undefined;
      if (user && user.role !== "SuperAdmin" && user.jobSite !== "HeadOffice") {
        targetJobSite = user.jobSite as JobSite;
      } else if (req.body.targetJobSite) {
        targetJobSite = req.body.targetJobSite as JobSite;
      }

      const parseResult = await parseExcelReport(
        req.file.buffer,
        req.file.originalname,
        targetJobSite
      );

      let periodsFilter: string[] | null = null;
      if (req.body.periodsToImport) {
        try {
          periodsFilter = JSON.parse(req.body.periodsToImport);
        } catch {
          periodsFilter = Array.isArray(req.body.periodsToImport)
            ? req.body.periodsToImport
            : [req.body.periodsToImport];
        }
      }

      if (periodsFilter && periodsFilter.length > 0) {
        const filterSet = new Set(periodsFilter.map((p) => p.trim().toLowerCase()));
        reportsToCommit = parseResult.reports.filter((r) =>
          filterSet.has(r.periodName.trim().toLowerCase())
        );
      } else {
        reportsToCommit = parseResult.reports;
      }
    } else if (req.body.reports && Array.isArray(req.body.reports)) {
      reportsToCommit = req.body.reports;
    } else {
      return res.status(400).json({
        success: false,
        message: "Tidak ada data laporan yang valid untuk disimpan",
      });
    }

    if (reportsToCommit.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Tidak ada periode yang dipilih untuk diimpor",
      });
    }

    // Site security validation
    for (const rep of reportsToCommit) {
      if (user && user.role !== "SuperAdmin" && user.jobSite !== "HeadOffice") {
        if (rep.jobSite !== user.jobSite) {
          return res.status(403).json({
            success: false,
            message: `Akses Ditolak: Anda hanya memiliki akses untuk mengimpor Site ${user.jobSite}!`,
          });
        }
      }
    }

    const savedReports: any[] = [];

    for (const rep of reportsToCommit) {
      const saved = await prisma.weeklyReport.upsert({
        where: {
          jobSite_year_weekNumber: {
            jobSite: rep.jobSite as JobSite,
            year: rep.year,
            weekNumber: rep.weekNumber,
          },
        },
        update: {
          periodName: rep.periodName,
          startDate: new Date(rep.startDate),
          endDate: new Date(rep.endDate),
          budgetProduksi: rep.produksi.weeklyBudget,
          realisasiProduksi: rep.produksi.weeklyRealisasi,
          mtdBudgetProduksi: rep.produksi.rawBudget,
          mtdRealisasiProduksi: rep.produksi.rawRealisasi,
          ytdBudgetProduksi: rep.produksi.ytdBudget,
          ytdRealisasiProduksi: rep.produksi.ytdRealisasi,
          status: "Final",
        },
        create: {
          jobSite: rep.jobSite as JobSite,
          periodName: rep.periodName,
          startDate: new Date(rep.startDate),
          endDate: new Date(rep.endDate),
          year: rep.year,
          weekNumber: rep.weekNumber,
          budgetProduksi: rep.produksi.weeklyBudget,
          realisasiProduksi: rep.produksi.weeklyRealisasi,
          mtdBudgetProduksi: rep.produksi.rawBudget,
          mtdRealisasiProduksi: rep.produksi.rawRealisasi,
          ytdBudgetProduksi: rep.produksi.ytdBudget,
          ytdRealisasiProduksi: rep.produksi.ytdRealisasi,
          status: "Final",
        },
      });

      // Batch recreate items for ultra-fast saving (2 queries instead of 86 serial roundtrips)
      await prisma.weeklyReportItem.deleteMany({
        where: { reportId: saved.id },
      });

      const itemsToCreate = rep.items.map((it) => ({
        reportId: saved.id,
        accountName: it.accountName,
        accountCode: it.accountCode,
        costBehavior: it.costBehavior,
        accountGroup: it.accountGroup,
        subCategory: it.subCategory,
        isParent: it.isParent,
        parentName: it.parentName,
        orderIndex: it.orderIndex,
        budgetCost: it.weeklyBudgetCost,
        realisasiCost: it.weeklyRealisasiCost,
        mtdBudgetCost: it.rawBudgetCost,
        mtdRealisasiCost: it.rawRealisasiCost,
        ytdBudgetCost: it.ytdBudgetCost,
        ytdRealisasiCost: it.ytdRealisasiCost,
      }));

      await prisma.weeklyReportItem.createMany({
        data: itemsToCreate,
      });

      savedReports.push({
        id: saved.id,
        jobSite: saved.jobSite,
        periodName: saved.periodName,
        weekNumber: saved.weekNumber,
        weeklyProduksi: {
          budget: saved.budgetProduksi,
          realisasi: saved.realisasiProduksi,
        },
      });
    }

    // Automatically synchronize Month 10 in PLSummaryOps for all imported sites
    const siteYears = new Set(reportsToCommit.map((r: any) => `${r.jobSite}_${r.year}`));
    for (const sy of Array.from(siteYears)) {
      const [site, yr] = sy.split("_");
      await syncSummaryForMonth(site as JobSite, parseInt(yr, 10), 10);
    }

    res.json({
      success: true,
      message: `Berhasil mengimpor dan memperbarui ${savedReports.length} periode laporan mingguan ke database.`,
      importedReports: savedReports,
    });
  } catch (error: any) {
    console.error("Error committing excel upload:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Gagal menyimpan data laporan ke database",
    });
  }
};

export const getLatestDataUpdates = async (req: Request, res: Response) => {
  try {
    const [latestGL, latestWeekly, latestSummary, latestProduction, latestRiver] = await Promise.all([
      // 1. GL Raw Data
      prisma.gLPeriod.findFirst({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          periodName: true,
          fileName: true,
          totalTransactions: true,
          totalDebet: true,
          createdAt: true,
        },
      }),
      // 2. Weekly Cost Report
      prisma.weeklyReport.findFirst({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          periodName: true,
          jobSite: true,
          weekNumber: true,
          year: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
      // 3. PL Summary Ops
      prisma.pLSummaryOps.findFirst({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          periodName: true,
          jobSite: true,
          monthLabel: true,
          year: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
      // 4. Coal Production
      prisma.dailyProduction.findFirst({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          date: true,
          weekNumber: true,
          jobSite: true,
          production: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
      // 5. River Journal
      prisma.riverJournal.findFirst({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          date: true,
          location: true,
          site: true,
          waterDepth: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
    ]);

    const updates = [];

    if (latestGL) {
      updates.push({
        id: `gl-${latestGL.id}`,
        module: "GL Raw Data",
        category: "gl-data",
        title: `Upload GL: ${latestGL.periodName}`,
        description: `File "${latestGL.fileName}" (${latestGL.totalTransactions.toLocaleString()} transaksi)`,
        timestamp: latestGL.createdAt,
        type: "upload",
      });
    }

    if (latestWeekly) {
      updates.push({
        id: `cost-${latestWeekly.id}`,
        module: "Laporan Cost",
        category: "reports",
        title: `Laporan Cost: ${latestWeekly.periodName} (${latestWeekly.jobSite})`,
        description: `Minggu ${latestWeekly.weekNumber} Tahun ${latestWeekly.year}`,
        timestamp: latestWeekly.updatedAt || latestWeekly.createdAt,
        type: "report",
      });
    }

    if (latestSummary) {
      updates.push({
        id: `summary-${latestSummary.id}`,
        module: "Laporan Summary",
        category: "summary",
        title: `Summary Ops: ${latestSummary.periodName} (${latestSummary.jobSite})`,
        description: `PL Summary Bulan ${latestSummary.monthLabel} ${latestSummary.year}`,
        timestamp: latestSummary.updatedAt || latestSummary.createdAt,
        type: "summary",
      });
    }

    if (latestProduction) {
      updates.push({
        id: `prod-${latestProduction.id}`,
        module: "Coal Hauling Produksi",
        category: "coal-dashboard",
        title: `Produksi Coal Hauling: ${latestProduction.date} (${latestProduction.jobSite})`,
        description: `Produksi ${latestProduction.production.toLocaleString()} Ton (${latestProduction.weekNumber})`,
        timestamp: latestProduction.updatedAt || latestProduction.createdAt,
        type: "production",
      });
    }

    if (latestRiver) {
      updates.push({
        id: `river-${latestRiver.id}`,
        module: "River Journal",
        category: "river-journal",
        title: `Kedalaman Air: ${latestRiver.date} (${latestRiver.site})`,
        description: `Lokasi ${latestRiver.location} (${latestRiver.waterDepth} m)`,
        timestamp: latestRiver.updatedAt || latestRiver.createdAt,
        type: "river",
      });
    }

    // Sort descending by timestamp
    updates.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const latestTimestamp = updates.length > 0 ? updates[0].timestamp : null;

    res.json({
      success: true,
      latestTimestamp,
      updates,
    });
  } catch (error: any) {
    console.error("Error getting latest data updates:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data update terbaru",
    });
  }
};


