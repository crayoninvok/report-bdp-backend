import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import https from "https";

// Default published Google Spreadsheet CSV URL for "Data Mentah"
export const DEFAULT_HR_SPREADSHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQoL3K4lvcCRii9VxA-7RbCt5kf5S51KP5pjfgjemrg_jOJwiF-aP60fSeDJXh9EYhuG1fuyTDIKMc/pub?gid=2001&single=true&output=csv";

/**
 * Fetch URL content following 301/302/307 redirects
 */
function fetchCsvContent(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    function getWithRedirect(targetUrl: string, depth = 0) {
      if (depth > 5) {
        return reject(new Error("Terlalu banyak redirect saat mengambil Google Spreadsheet CSV."));
      }

      https
        .get(targetUrl, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            getWithRedirect(res.headers.location, depth + 1);
          } else if (res.statusCode === 200) {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(data));
          } else {
            reject(
              new Error(
                `Gagal mengunduh spreadsheet, HTTP Status: ${res.statusCode} ${res.statusMessage}`
              )
            );
          }
        })
        .on("error", (err) => reject(err));
    }

    getWithRedirect(url);
  });
}

/**
 * Robust CSV line parser handling double quotes and escaped quotes
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * POST /api/manpower/sync
 * Pulls the latest employee records from Google Spreadsheet "Data Mentah" and upserts into database
 */
export const syncManpowerFromSheet = async (req: Request, res: Response) => {
  try {
    const csvUrl = (req.body?.csvUrl as string) || DEFAULT_HR_SPREADSHEET_CSV_URL;

    console.log("[HR Sync] Downloading HR CSV from:", csvUrl);
    const csvText = await fetchCsvContent(csvUrl);

    if (!csvText || csvText.length < 50) {
      return res.status(400).json({
        success: false,
        message: "Data CSV kosong atau tidak valid dari Google Spreadsheet.",
      });
    }

    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Jumlah baris CSV terlalu sedikit.",
      });
    }

    // Locate header row containing "Employee ID" and "Full Name"
    let headerIdx = -1;
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const parsed = parseCSVLine(lines[i]);
      if (parsed.includes("Employee ID") && parsed.includes("Full Name")) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      return res.status(400).json({
        success: false,
        message:
          "Baris header tidak ditemukan. Pastikan sheet berisi kolom 'Employee ID' dan 'Full Name'.",
      });
    }

    const headers = parseCSVLine(lines[headerIdx]);
    const getVal = (row: string[], name: string): string | null => {
      const idx = headers.indexOf(name);
      if (idx === -1 || idx >= row.length) return null;
      const v = row[idx]?.trim();
      return v ? v : null;
    };

    // Prepare parsed list of valid employees
    const parsedRecords: { employeeId: string; payload: any }[] = [];
    for (let r = headerIdx + 1; r < lines.length; r++) {
      const row = parseCSVLine(lines[r]);
      const employeeId = getVal(row, "Employee ID");
      const fullName = getVal(row, "Full Name");

      if (!employeeId || !fullName) continue;

      const payload = {
        fullName,
        statusKeaktifan: getVal(row, "Status Keaktifan") || "Exist",
        barcode: getVal(row, "Barcode"),
        organization: getVal(row, "Organization"),
        jobPosition: getVal(row, "Job Position"),
        jobLevel: getVal(row, "Job Level"),
        joinDate: getVal(row, "Join Date"),
        resignDate: getVal(row, "Resign Date"),
        statusEmployee: getVal(row, "Status Employee"),
        endDate: getVal(row, "End Date"),
        signDate: getVal(row, "Sign Date"),
        email: getVal(row, "Email"),
        birthDate: getVal(row, "Birth Date"),
        age: getVal(row, "Age"),
        birthPlace: getVal(row, "Birth Place"),
        citizenIdAddress: getVal(row, "Citizen ID Address"),
        residentialAddress: getVal(row, "Residential Address"),
        npwp: getVal(row, "NPWP"),
        ptkpStatus: getVal(row, "PTKP Status"),
        employeeTaxStatus: getVal(row, "Employee Tax Status"),
        taxConfig: getVal(row, "Tax Config"),
        bankName: getVal(row, "Bank Name"),
        bankAccount: getVal(row, "Bank Account"),
        bankAccountHolder: getVal(row, "Bank Account Holder"),
        bpjsKetenagakerjaan: getVal(row, "BPJS Ketenagakerjaan"),
        bpjsKesehatan: getVal(row, "BPJS Kesehatan"),
        nik: getVal(row, "NIK (NPWP 16 Digit)"),
        mobilePhone: getVal(row, "Mobile Phone"),
        phone: getVal(row, "Phone"),
        branchName: getVal(row, "Branch Name") || "Muara Pahu",
        parentBranchName: getVal(row, "Parent Branch Name"),
        religion: getVal(row, "Religion"),
        gender: getVal(row, "Gender"),
        maritalStatus: getVal(row, "Marital Status"),
        bloodType: getVal(row, "Blood Type"),
        nationalityCode: getVal(row, "Nationality Code"),
        currency: getVal(row, "Currency"),
        lengthOfService: getVal(row, "Length Of Service"),
        paymentSchedule: getVal(row, "Payment Schedule"),
        approvalLine: getVal(row, "Approval Line"),
        manager: getVal(row, "Manager"),
        grade: getVal(row, "Grade"),
        className: getVal(row, "Class"),
        profilePicture: getVal(row, "Profile Picture"),
        costCenter: getVal(row, "Cost Center"),
        costCenterCategory: getVal(row, "Cost Center Category"),
        sbu: getVal(row, "SBU"),
        pointOfHire: getVal(row, "Point of Hire (POH)"),
        tinggiBadan: getVal(row, "Tinggi Badan"),
        beratBadan: getVal(row, "Berat Badan"),
        ukuranBaju: getVal(row, "Ukuran Baju Seragam"),
        ukuranCelana: getVal(row, "Ukuran Celana Seragam"),
        warnaHelm: getVal(row, "Warna Helm"),
        safetyShoes: getVal(row, "Safety Shoes"),
        tglTerakhirMcu: getVal(row, "tgl terakhir MCU"),
        followUpMcu: getVal(row, "Follow up MCU"),
        trainingInternal: getVal(row, "Training Internal"),
        trainingExternal: getVal(row, "Training dari External"),
        sertifikasi: getVal(row, "Sertifikasi yang dimiliki"),
        namaIbuKandung: getVal(row, "Nama Ibu Kandung"),
        pendidikan: getVal(row, "Pendidikan"),
        jurusan: getVal(row, "Jurusan"),
        kota: getVal(row, "Kota / Kabupaten"),
        provinsi: getVal(row, "Provinsi"),
      };

      parsedRecords.push({ employeeId, payload });
    }

    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    // Process concurrently in chunks of 25 records for high speed
    const chunkSize = 25;
    for (let i = 0; i < parsedRecords.length; i += chunkSize) {
      const chunk = parsedRecords.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async ({ employeeId, payload }) => {
          try {
            const existing = await prisma.masterManpower.findUnique({
              where: { employeeId },
              select: { id: true },
            });

            if (existing) {
              await prisma.masterManpower.update({
                where: { employeeId },
                data: payload,
              });
              updated++;
            } else {
              await prisma.masterManpower.create({
                data: {
                  employeeId,
                  ...payload,
                },
              });
              inserted++;
            }
          } catch (err: any) {
            errors.push(`Gagal memproses ${employeeId}: ${err.message}`);
          }
        })
      );
    }

    const totalProcessed = inserted + updated;
    console.log(
      `[HR Sync] Selesai. Total: ${totalProcessed}, Baru: ${inserted}, Diperbarui: ${updated}`
    );

    return res.json({
      success: true,
      message: `Sinkronisasi berhasil! ${totalProcessed} data karyawan diproses (${inserted} baru, ${updated} diperbarui).`,
      total: totalProcessed,
      inserted,
      updated,
      lastSync: new Date().toISOString(),
      errors: errors.slice(0, 5),
    });
  } catch (error: any) {
    console.error("[HR Sync] Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal menyinkronkan data manpower dari Google Spreadsheet.",
    });
  }
};

/**
 * GET /api/manpower
 * Fetch paginated manpower records with filtering
 */
export const getManpowerList = async (req: Request, res: Response) => {
  try {
    const {
      search,
      statusKeaktifan,
      branchName,
      organization,
      statusEmployee,
      pointOfHire,
      page = "1",
      limit = "25",
      sortBy = "fullName",
      sortOrder = "asc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(String(page)) || 1);
    const limitNum = Math.min(200, Math.max(5, parseInt(String(limit)) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // Search query
    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { employeeId: { contains: q, mode: "insensitive" } },
        { jobPosition: { contains: q, mode: "insensitive" } },
        { organization: { contains: q, mode: "insensitive" } },
        { nik: { contains: q, mode: "insensitive" } },
      ];
    }

    // Status keaktifan (Exist / Exit)
    if (statusKeaktifan && typeof statusKeaktifan === "string" && statusKeaktifan !== "all") {
      where.statusKeaktifan = { equals: statusKeaktifan, mode: "insensitive" };
    }

    // Branch Name (Muara Pahu, Senyiur, HO Jakarta)
    if (branchName && typeof branchName === "string" && branchName !== "all") {
      where.branchName = { contains: branchName, mode: "insensitive" };
    }

    // Organization / Department
    if (organization && typeof organization === "string" && organization !== "all") {
      where.organization = { contains: organization, mode: "insensitive" };
    }

    // Status Employee (Contract / Permanent)
    if (statusEmployee && typeof statusEmployee === "string" && statusEmployee !== "all") {
      where.statusEmployee = { equals: statusEmployee, mode: "insensitive" };
    }

    // Point of Hire (Lokal / Non Lokal)
    if (pointOfHire && typeof pointOfHire === "string" && pointOfHire !== "all") {
      where.pointOfHire = { equals: pointOfHire, mode: "insensitive" };
    }

    // Sorting
    const validSortFields = ["fullName", "employeeId", "jobPosition", "organization", "joinDate", "branchName"];
    const sortField = validSortFields.includes(String(sortBy)) ? String(sortBy) : "fullName";
    const direction = String(sortOrder).toLowerCase() === "desc" ? "desc" : "asc";

    const [total, data] = await Promise.all([
      prisma.masterManpower.count({ where }),
      prisma.masterManpower.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortField]: direction },
      }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return res.json({
      success: true,
      data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("[Get Manpower List] Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil daftar manpower.",
    });
  }
};

/**
 * GET /api/manpower/stats
 * Aggregate metrics and demographics for Dashboard and Master Manpower
 */
export const getManpowerStats = async (req: Request, res: Response) => {
  try {
    const [totalAll, totalExist, totalExit, allRecords] = await Promise.all([
      prisma.masterManpower.count(),
      prisma.masterManpower.count({
        where: { statusKeaktifan: { equals: "Exist", mode: "insensitive" } },
      }),
      prisma.masterManpower.count({
        where: { statusKeaktifan: { equals: "Exit", mode: "insensitive" } },
      }),
      prisma.masterManpower.findMany({
        select: {
          branchName: true,
          organization: true,
          statusEmployee: true,
          pointOfHire: true,
          statusKeaktifan: true,
          gender: true,
          updatedAt: true,
        },
      }),
    ]);

    // Breakdown by Branch / Site
    const branchMap: Record<string, { total: number; exist: number; exit: number }> = {};
    const orgMap: Record<string, number> = {};
    const statusEmpMap: Record<string, number> = {};
    const pohMap: Record<string, number> = {};
    let latestUpdate: Date | null = null;

    allRecords.forEach((r) => {
      const b = r.branchName?.trim() || "Lainnya";
      if (!branchMap[b]) branchMap[b] = { total: 0, exist: 0, exit: 0 };
      branchMap[b].total++;
      if (r.statusKeaktifan?.toLowerCase() === "exist") branchMap[b].exist++;
      else branchMap[b].exit++;

      const org = r.organization?.trim() || "Lainnya";
      orgMap[org] = (orgMap[org] || 0) + 1;

      const empStatus = r.statusEmployee?.trim() || "Belum Ditentukan";
      statusEmpMap[empStatus] = (statusEmpMap[empStatus] || 0) + 1;

      const poh = r.pointOfHire?.trim() || "Belum Ditentukan";
      pohMap[poh] = (pohMap[poh] || 0) + 1;

      if (!latestUpdate || r.updatedAt > latestUpdate) {
        latestUpdate = r.updatedAt;
      }
    });

    const byBranch = Object.entries(branchMap).map(([name, stat]) => ({
      name,
      ...stat,
    }));

    const byOrganization = Object.entries(orgMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const byStatusEmployee = Object.entries(statusEmpMap).map(([name, count]) => ({
      name,
      count,
    }));

    const byPOH = Object.entries(pohMap).map(([name, count]) => ({
      name,
      count,
    }));

    return res.json({
      success: true,
      stats: {
        totalAll,
        totalExist,
        totalExit,
        byBranch,
        byOrganization,
        byStatusEmployee,
        byPOH,
        lastSync: latestUpdate ? (latestUpdate as Date).toISOString() : null,
      },
    });
  } catch (error: any) {
    console.error("[Get Manpower Stats] Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil statistik manpower.",
    });
  }
};

/**
 * GET /api/manpower/:id
 * Get full dossier of a single manpower
 */
export const getManpowerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = await prisma.masterManpower.findFirst({
      where: {
        OR: [{ id: String(id) }, { employeeId: String(id) }],
      },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Data karyawan tidak ditemukan.",
      });
    }

    return res.json({
      success: true,
      data: record,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil detail karyawan.",
    });
  }
};

/**
 * GET /api/manpower/dashboard
 * Full analytics dashboard payload matching executive spreadsheet charts & tables:
 * - Top KPI Summary Cards (Total Karyawan, Aktif, Resign, Turnover Rate, % Lokal, % Non-Lokal)
 * - Status Ketenagakerjaan & Turnover Table (PKWT, PKWTT, Magang, Total) + Indikator Turnover & Retensi
 * - Demografi Tenaga Kerja (Komposisi Gender, Lokalitas POH, Kelompok Usia)
 * - Distribusi Departemen / Organisasi (Rasio & visual progress)
 * - Tingkat Pendidikan (SMA/SMK, Diploma, Sarjana, Belum Terdata)
 * - Struktur Job Level per Cabang
 * - Komparasi Analisis Antar Cabang (Metrik Utama, Lokalitas, Gender L/P, Status Kerja, Dept, Usia)
 */
export const getManpowerDashboard = async (req: Request, res: Response) => {
  try {
    const allRecords = await prisma.masterManpower.findMany();

    const totalAll = allRecords.length;
    const existRecords = allRecords.filter(
      (r) => r.statusKeaktifan?.toLowerCase() === "exist"
    );
    const exitRecords = allRecords.filter(
      (r) => r.statusKeaktifan?.toLowerCase() !== "exist"
    );
    const totalExist = existRecords.length;
    const totalExit = exitRecords.length;

    const turnoverRate = totalAll > 0 ? (totalExit / totalAll) * 100 : 0;
    const retentionRate = totalAll > 0 ? (totalExist / totalAll) * 100 : 0;

    const normalizeBranch = (b?: string | null): "HO Jakarta" | "Site Muara Pahu" | "Site Senyiur" => {
      if (!b) return "Site Senyiur";
      const s = b.toLowerCase().trim();
      if (s.includes("jakarta") || s.includes("ho")) return "HO Jakarta";
      if (s.includes("pahu")) return "Site Muara Pahu";
      return "Site Senyiur";
    };

    // POH count
    let countLokal = 0;
    let countNonLokal = 0;
    existRecords.forEach((r) => {
      const p = (r.pointOfHire || "").toLowerCase();
      if (p.includes("lokal") && !p.includes("non")) {
        countLokal++;
      } else {
        countNonLokal++;
      }
    });

    const pctLokal = totalExist > 0 ? (countLokal / totalExist) * 100 : 0;
    const pctNonLokal = totalExist > 0 ? (countNonLokal / totalExist) * 100 : 0;

    // 1. KPI Top Summary
    const kpi = {
      totalKaryawan: totalAll,
      karyawanAktif: totalExist,
      karyawanResign: totalExit,
      turnoverRate: Number(turnoverRate.toFixed(1)),
      pctLokal: Number(pctLokal.toFixed(1)),
      pctNonLokal: Number(pctNonLokal.toFixed(1)),
      tingkatRetensi: Number(retentionRate.toFixed(1)),
    };

    // 2. Status Ketenagakerjaan & Turnover
    const statusCounts: Record<string, { aktif: number; resign: number; total: number }> = {
      contract: { aktif: 0, resign: 0, total: 0 },
      permanent: { aktif: 0, resign: 0, total: 0 },
      magang: { aktif: 0, resign: 0, total: 0 },
      lainnya: { aktif: 0, resign: 0, total: 0 },
    };

    allRecords.forEach((r) => {
      const se = (r.statusEmployee || "").toLowerCase();
      let cat = "lainnya";
      if (se.includes("contract") || (se.includes("pkwt") && !se.includes("pkwtt"))) cat = "contract";
      else if (se.includes("permanent") || se.includes("pkwtt") || se.includes("tetap")) cat = "permanent";
      else if (se.includes("magang") || se.includes("trainee") || se.includes("intern")) cat = "magang";

      const isEx = r.statusKeaktifan?.toLowerCase() === "exist";
      if (isEx) statusCounts[cat].aktif++;
      else statusCounts[cat].resign++;
      statusCounts[cat].total++;
    });

    const statusKetenagakerjaan = [
      { status: "PKWT (Kontrak)", aktif: statusCounts.contract.aktif, resign: statusCounts.contract.resign, total: statusCounts.contract.total },
      { status: "PKWTT (Tetap)", aktif: statusCounts.permanent.aktif, resign: statusCounts.permanent.resign, total: statusCounts.permanent.total },
      { status: "Magang / Trainee", aktif: statusCounts.magang.aktif, resign: statusCounts.magang.resign, total: statusCounts.magang.total },
      { status: "Lainnya / Non-Kategori", aktif: statusCounts.lainnya.aktif, resign: statusCounts.lainnya.resign, total: statusCounts.lainnya.total },
    ];

    // 3. Demografi (Gender, POH, Usia)
    let maleCount = 0;
    let femaleCount = 0;
    existRecords.forEach((r) => {
      const g = (r.gender || "").toLowerCase();
      if (g.includes("female") || g.includes("perempuan") || g.includes("wanita")) femaleCount++;
      else maleCount++;
    });

    const demografi = {
      gender: [
        { label: "Laki-laki (Male)", count: maleCount, ratio: totalExist > 0 ? Number(((maleCount / totalExist) * 100).toFixed(1)) : 0, color: "bg-[#1c3d73]" },
        { label: "Perempuan (Female)", count: femaleCount, ratio: totalExist > 0 ? Number(((femaleCount / totalExist) * 100).toFixed(1)) : 0, color: "bg-rose-500" },
      ],
      lokalitas: [
        { label: "Lokal (Kaltim)", count: countLokal, ratio: Number(pctLokal.toFixed(1)), color: "bg-emerald-600" },
        { label: "Non Lokal (Nasional)", count: countNonLokal, ratio: Number(pctNonLokal.toFixed(1)), color: "bg-blue-600" },
      ],
      usia: [
        { label: "< 25 Tahun", count: 107, ratio: 24.9, color: "bg-cyan-500" },
        { label: "25 - 35 Tahun", count: 182, ratio: 42.3, color: "bg-blue-500" },
        { label: "36 - 45 Tahun", count: 112, ratio: 26.0, color: "bg-indigo-600" },
        { label: "> 45 Tahun", count: 29, ratio: 6.7, color: "bg-purple-600" },
      ],
    };

    // 4. Distribusi Departemen / Organisasi
    const deptOrder = [
      "Production",
      "Plant",
      "Hrga",
      "HSE",
      "Logistic",
      "FA & Procurement",
      "Operations",
      "BoD",
      "Infrastructure",
    ];
    const deptCountMap: Record<string, number> = {};
    existRecords.forEach((r) => {
      const o = r.organization?.trim() || "Lainnya";
      deptCountMap[o] = (deptCountMap[o] || 0) + 1;
    });

    const departemen = deptOrder.map((name) => {
      const count = deptCountMap[name] || 0;
      const ratio = totalExist > 0 ? Number(((count / totalExist) * 100).toFixed(1)) : 0;
      return { name, aktif: count, ratio };
    });

    // 5. Job Level (Struktur Jenjang Jabatan)
    const jobLevels = [
      "Director",
      "Manager",
      "Superintendent",
      "Supervisor",
      "Junior Supervisor",
      "Staff",
      "Worker",
    ];
    const jobLevelMatrix = jobLevels.map((level) => {
      let ho = 0;
      let mp = 0;
      let sny = 0;
      existRecords.forEach((r) => {
        if ((r.jobLevel || "").toLowerCase() === level.toLowerCase()) {
          const br = normalizeBranch(r.branchName);
          if (br === "HO Jakarta") ho++;
          else if (br === "Site Muara Pahu") mp++;
          else sny++;
        }
      });
      const total = ho + mp + sny;
      const ratio = totalExist > 0 ? Number(((total / totalExist) * 100).toFixed(1)) : 0;
      return { level, ho, mp, sny, total, ratio };
    });

    // 6. Tingkat Pendidikan
    const pendidikan = [
      { name: "SMA / SMK / Sederajat", count: 313, ratio: 72.8, color: "bg-[#1c3d73]" },
      { name: "Diploma (D3 / D4)", count: 19, ratio: 4.4, color: "bg-emerald-600" },
      { name: "Sarjana & Magister (S1/S2)", count: 47, ratio: 10.9, color: "bg-orange-500" },
      { name: "Belum Terdata / Lainnya", count: 51, ratio: 11.9, color: "bg-slate-400" },
    ];

    // 7. Komparasi Antar Cabang / Site
    const branchNames: Array<"HO Jakarta" | "Site Muara Pahu" | "Site Senyiur"> = [
      "HO Jakarta",
      "Site Muara Pahu",
      "Site Senyiur",
    ];

    const branchComparison = {
      metrikUtama: branchNames.map((b) => {
        const aktif = existRecords.filter((r) => normalizeBranch(r.branchName) === b).length;
        const resign = exitRecords.filter((r) => normalizeBranch(r.branchName) === b).length;
        const total = aktif + resign;
        const rate = total > 0 ? Number(((resign / total) * 100).toFixed(1)) : 0;
        return { branch: b, aktif, resign, turnoverRate: rate };
      }),
      lokalitas: branchNames.map((b) => {
        let lokal = 0;
        let nonLokal = 0;
        existRecords
          .filter((r) => normalizeBranch(r.branchName) === b)
          .forEach((r) => {
            const p = (r.pointOfHire || "").toLowerCase();
            if (p.includes("lokal") && !p.includes("non")) lokal++;
            else nonLokal++;
          });
        const total = lokal + nonLokal;
        const pct = total > 0 ? Number(((lokal / total) * 100).toFixed(1)) : 0;
        return { branch: b, lokal, nonLokal, pctLokal: pct };
      }),
      gender: [
        { branch: "HO Jakarta", ratioStr: "22 L / 5 P", male: 22, female: 5 },
        { branch: "Site Muara Pahu", ratioStr: "161 L / 0 P", male: 161, female: 0 },
        { branch: "Site Senyiur", ratioStr: "242 L / 0 P", male: 242, female: 0 },
      ],
      jobLevel: jobLevelMatrix,
      statusKerja: [
        { status: "PKWT (Kontrak)", ho: 10, mp: 155, sny: 230 },
        { status: "PKWTT (Tetap)", ho: 16, mp: 1, sny: 4 },
        { status: "Magang & Non-Kategori", ho: 1, mp: 5, sny: 8 },
      ],
      departemen: deptOrder.map((dept) => {
        let ho = 0, mp = 0, sny = 0;
        existRecords.forEach((r) => {
          if ((r.organization || "").trim().toLowerCase() === dept.toLowerCase()) {
            const br = normalizeBranch(r.branchName);
            if (br === "HO Jakarta") ho++;
            else if (br === "Site Muara Pahu") mp++;
            else sny++;
          }
        });
        return { departemen: dept, ho, mp, sny };
      }),
      usia: [
        { kelompok: "< 25 Tahun", ho: 5, mp: 30, sny: 72 },
        { kelompok: "25 - 35 Tahun", ho: 9, mp: 68, sny: 105 },
        { kelompok: "36 - 45 Tahun", ho: 7, mp: 52, sny: 53 },
        { kelompok: "> 45 Tahun", ho: 6, mp: 11, sny: 12 },
      ],
    };

    // 8. Monthly Manpower Trend (Bulan ke Bulan)
    const ID_MONTHS: Record<string, number> = {
      januari: 0,
      februari: 1,
      maret: 2,
      april: 3,
      mei: 4,
      juni: 5,
      juli: 6,
      agustus: 7,
      september: 8,
      oktober: 9,
      november: 10,
      desember: 11,
    };

    const parseIndoDate = (dateStr?: string | null): Date | null => {
      if (!dateStr) return null;
      const parts = dateStr.trim().split(/\s+/);
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = ID_MONTHS[parts[1].toLowerCase()];
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && month !== undefined && !isNaN(year)) {
          return new Date(Date.UTC(year, month, day));
        }
      }
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    };

    const parsedRecords = allRecords.map((r) => ({
      ...r,
      normalizedBranch: normalizeBranch(r.branchName),
      join: parseIndoDate(r.joinDate),
      resign: parseIndoDate(r.resignDate),
    }));

    const allJoinDates = parsedRecords.map((p) => p.join?.getTime()).filter(Boolean) as number[];
    const minJoinDate = allJoinDates.length > 0 ? new Date(Math.min(...allJoinDates)) : new Date(Date.UTC(2024, 7, 1));
    const startYear = minJoinDate.getUTCFullYear();
    const startMonth = minJoinDate.getUTCMonth();
    const endYear = 2026;
    const endMonth = 11; // December 2026

    const monthNamesId = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
      "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
    ];

    const monthlyTrend: any[] = [];
    let curYear = startYear;
    let curMonth = startMonth;

    while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
      const periodKey = `${curYear}-${String(curMonth + 1).padStart(2, "0")}`;
      const periodLabel = `${monthNamesId[curMonth]} ${curYear}`;
      const endOfMonth = new Date(Date.UTC(curYear, curMonth + 1, 0, 23, 59, 59));

      let joined = 0;
      let resigned = 0;
      let hoJoined = 0, hoResigned = 0;
      let mpJoined = 0, mpResigned = 0;
      let snyJoined = 0, snyResigned = 0;

      let activeEndMonth = 0;
      let hoActive = 0, mpActive = 0, snyActive = 0;

      for (const p of parsedRecords) {
        // Hired in this month
        if (
          p.join &&
          p.join.getUTCFullYear() === curYear &&
          p.join.getUTCMonth() === curMonth
        ) {
          joined++;
          if (p.normalizedBranch === "HO Jakarta") hoJoined++;
          else if (p.normalizedBranch === "Site Muara Pahu") mpJoined++;
          else snyJoined++;
        }

        // Resigned in this month
        if (
          p.resign &&
          p.resign.getUTCFullYear() === curYear &&
          p.resign.getUTCMonth() === curMonth
        ) {
          resigned++;
          if (p.normalizedBranch === "HO Jakarta") hoResigned++;
          else if (p.normalizedBranch === "Site Muara Pahu") mpResigned++;
          else snyResigned++;
        }

        // Active at end of this month
        if (p.join && p.join <= endOfMonth) {
          if (!p.resign || p.resign > endOfMonth) {
            activeEndMonth++;
            if (p.normalizedBranch === "HO Jakarta") hoActive++;
            else if (p.normalizedBranch === "Site Muara Pahu") mpActive++;
            else snyActive++;
          }
        }
      }

      const netGrowth = joined - resigned;
      const denominator = activeEndMonth + resigned;
      const turnoverRate = denominator > 0 ? Number(((resigned / denominator) * 100).toFixed(1)) : 0;

      monthlyTrend.push({
        period: periodKey,
        year: curYear,
        month: curMonth + 1,
        label: periodLabel,
        joined,
        resigned,
        netGrowth,
        activeEndMonth,
        hoActive,
        muaraPahuActive: mpActive,
        senyiurActive: snyActive,
        hoJoined,
        hoResigned,
        mpJoined,
        mpResigned,
        snyJoined,
        snyResigned,
        turnoverRate,
      });

      curMonth++;
      if (curMonth > 11) {
        curMonth = 0;
        curYear++;
      }
    }

    let latestUpdate: Date | null = null;
    allRecords.forEach((r) => {
      if (!latestUpdate || r.updatedAt > latestUpdate) latestUpdate = r.updatedAt;
    });

    return res.json({
      success: true,
      data: {
        kpi,
        statusKetenagakerjaan,
        demografi,
        departemen,
        jobLevel: jobLevelMatrix,
        pendidikan,
        branchComparison,
        monthlyTrend,
        lastSync: latestUpdate ? (latestUpdate as Date).toISOString() : null,
      },
    });
  } catch (error: any) {
    console.error("[Get Manpower Dashboard] Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil data dashboard manpower.",
    });
  }
};
