import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

const DEFAULT_PLAFON_AMOUNT = 5500000; // Rp 5.500.000,00 (5,5 Juta)

/**
 * Helper to determine reset cycle in days based on employee job position:
 * - 48 Hari: Project Manager, Deputy Pjo
 * - 90 Hari: Admin, Driver Double Trailer, Mechanic, Electrician, Welder
 * - 65 Hari: Posisi lainnya (Default)
 */
export function getResetCycleDays(jobPosition?: string | null): number {
  if (!jobPosition) return 65;
  const pos = jobPosition.toLowerCase().trim();

  // 48 Hari: Project Manager, Deputy Pjo
  if (pos.includes("project manager") || pos.includes("deputy pjo")) {
    return 48;
  }

  // 90 Hari: Admin, Driver Double Trailer, Mechanic, Electrician, Welder
  if (
    pos.includes("driver double trailer") ||
    pos.includes("mechanic") ||
    pos.includes("electrician") ||
    pos.includes("welder") ||
    pos.includes("admin")
  ) {
    return 90;
  }

  // 65 Hari: Posisi lainnya
  return 65;
}

/**
 * Helper to calculate auto-reset date from departure date based on job position
 */
export function calculateResetDateByPosition(departureDate: Date, jobPosition?: string | null): Date {
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
export async function getTicketPlafonList(req: Request, res: Response) {
  try {
    const { site, search, department } = req.query;

    const now = new Date();

    // 1. First, perform automatic reset for records whose nextResetDate <= now and usedAmount > 0
    const expiredPlafons = await prisma.manpowerTicketPlafon.findMany({
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
      await prisma.$transaction(
        expiredPlafons.map((p) =>
          prisma.manpowerTicketPlafon.update({
            where: { id: p.id },
            data: {
              usedAmount: 0,
              notes: p.notes
                ? `${p.notes} (Auto-reset 65 hari ke Rp ${(p.plafonAmount || DEFAULT_PLAFON_AMOUNT).toLocaleString("id-ID")} pada ${now.toISOString().split("T")[0]})`
                : `Auto-reset 65 hari ke Rp ${(p.plafonAmount || DEFAULT_PLAFON_AMOUNT).toLocaleString("id-ID")} pada ${now.toISOString().split("T")[0]}`,
            },
          })
        )
      );
    }

    // 2. Build where filter for MasterManpower: statusKeaktifan = Exist, pointOfHire = Non Lokal
    const whereCondition: any = {
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
      } else if (siteStr.includes("muara") || siteStr.includes("pahu")) {
        whereCondition.branchName = {
          contains: "Pahu",
          mode: "insensitive",
        };
      } else if (siteStr.includes("jakarta") || siteStr.includes("ho") || siteStr.includes("head")) {
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
    const manpowerList = await prisma.masterManpower.findMany({
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
    const plafonRecords = await prisma.manpowerTicketPlafon.findMany({
      where: {
        employeeId: { in: employeeIds },
      },
    });

    const plafonMap = new Map<string, (typeof plafonRecords)[0]>();
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
    const allNonLokalCounts = await prisma.masterManpower.groupBy({
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
      } else if (bn.includes("pahu")) {
        countMuaraPahuTotal += c._count._all;
      } else if (bn.includes("jakarta") || bn.includes("ho")) {
        countHoJakartaTotal += c._count._all;
      } else {
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
  } catch (error: any) {
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
export async function recordTicketUsage(req: Request, res: Response) {
  try {
    const {
      employeeId,
      ticketNumber,
      destination,
      airline,
      departureDate,
      returnDate,
      ticketCost,
      notes,
    } = req.body;

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
    const employeeInfo = await prisma.masterManpower.findFirst({
      where: { employeeId: { equals: employeeId, mode: "insensitive" } },
      select: { jobPosition: true, fullName: true },
    });

    const resetCycleDays = getResetCycleDays(employeeInfo?.jobPosition);
    const nextResetDate = calculateResetDateByPosition(baseResetDate, employeeInfo?.jobPosition);

    // 1. Create TicketUsageHistory
    const history = await prisma.ticketUsageHistory.create({
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
    const existingPlafon = await prisma.manpowerTicketPlafon.findUnique({
      where: { employeeId },
    });

    let updatedPlafon;
    if (existingPlafon) {
      updatedPlafon = await prisma.manpowerTicketPlafon.update({
        where: { employeeId },
        data: {
          usedAmount: existingPlafon.usedAmount + costNum,
          lastDepartureDate: depDate,
          nextResetDate: nextResetDate,
          ticketCount: existingPlafon.ticketCount + 1,
          updatedAt: new Date(),
        },
      });
    } else {
      updatedPlafon = await prisma.manpowerTicketPlafon.create({
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
  } catch (error: any) {
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
export async function getTicketHistory(req: Request, res: Response) {
  try {
    const employeeId = String(req.params.employeeId);

    const history = await prisma.ticketUsageHistory.findMany({
      where: { employeeId },
      orderBy: { departureDate: "desc" },
    });

    const plafon = await prisma.manpowerTicketPlafon.findUnique({
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
  } catch (error: any) {
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
export async function updatePlafonConfig(req: Request, res: Response) {
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

    const plafon = await prisma.manpowerTicketPlafon.upsert({
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
  } catch (error: any) {
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
export async function resetPlafonManual(req: Request, res: Response) {
  try {
    const employeeId = String(req.params.employeeId);

    const plafon = await prisma.manpowerTicketPlafon.update({
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
  } catch (error: any) {
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
export async function getTicketAnalytics(req: Request, res: Response) {
  try {
    const { site, startDate } = req.query;

    const fromDate = startDate ? new Date(String(startDate)) : new Date("2026-04-01T00:00:00.000Z");

    const [manpowerList, tickets] = await Promise.all([
      prisma.masterManpower.findMany({
        select: {
          employeeId: true,
          fullName: true,
          branchName: true,
          jobPosition: true,
          organization: true,
        },
      }),
      prisma.ticketUsageHistory.findMany({
        where: {
          departureDate: {
            gte: fromDate,
          },
        },
        orderBy: { departureDate: "asc" },
      }),
    ]);

    const mpMap = new Map<string, (typeof manpowerList)[0]>();
    for (const m of manpowerList) {
      mpMap.set(m.employeeId, m);
    }

    // Filter tickets by site if specified
    const siteQuery = site ? String(site).trim().toLowerCase() : "all";
    const filteredTickets = tickets.filter((t) => {
      if (!siteQuery || siteQuery === "all") return true;
      const mp = mpMap.get(t.employeeId);
      const bn = (mp?.branchName || "").toLowerCase();
      if (siteQuery.includes("senyiur")) return bn.includes("senyiur");
      if (siteQuery.includes("pahu") || siteQuery.includes("muara")) return bn.includes("pahu");
      if (siteQuery.includes("jakarta") || siteQuery.includes("ho") || siteQuery.includes("head")) {
        return bn.includes("jakarta") || bn.includes("ho");
      }
      return true;
    });

    const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const monthlyMap: Record<string, any> = {};
    const empMap: Record<string, any> = {};

    let totalCostYtd = 0;
    const uniqueEmployeesYtd = new Set<string>();

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
          employees: new Set<string>(),
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
      } else if (bn.includes("pahu")) {
        monthlyMap[mKey].pahuCost += cost;
        monthlyMap[mKey].pahuTickets++;
      } else if (bn.includes("jakarta") || bn.includes("ho")) {
        monthlyMap[mKey].hoCost += cost;
        monthlyMap[mKey].hoTickets++;
      }

      const notesLow = (t.notes || "").toLowerCase();
      if (notesLow.includes("dinas")) {
        monthlyMap[mKey].dinasCount++;
      } else if (notesLow.includes("on site") || notesLow.includes("onsite")) {
        monthlyMap[mKey].onsiteCount++;
      } else {
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

    const monthlyTrends = Object.values(monthlyMap).map((m: any) => ({
      ...m,
      manpowerCount: m.employees.size,
      employees: undefined,
    }));

    const topManpower = Object.values(empMap)
      .sort((a: any, b: any) => b.totalCost - a.totalCost)
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
  } catch (error: any) {
    console.error("Error in getTicketAnalytics:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data analytics tiket: " + error.message,
    });
  }
}
