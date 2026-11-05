"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getManpowerById = exports.getManpowerStats = exports.getManpowerList = exports.syncManpowerFromSheet = exports.DEFAULT_HR_SPREADSHEET_CSV_URL = void 0;
const prisma_1 = require("../lib/prisma");
const https_1 = __importDefault(require("https"));
// Default published Google Spreadsheet CSV URL for "Data Mentah"
exports.DEFAULT_HR_SPREADSHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQoL3K4lvcCRii9VxA-7RbCt5kf5S51KP5pjfgjemrg_jOJwiF-aP60fSeDJXh9EYhuG1fuyTDIKMc/pub?gid=2001&single=true&output=csv";
/**
 * Fetch URL content following 301/302/307 redirects
 */
function fetchCsvContent(url) {
    return new Promise((resolve, reject) => {
        function getWithRedirect(targetUrl, depth = 0) {
            if (depth > 5) {
                return reject(new Error("Terlalu banyak redirect saat mengambil Google Spreadsheet CSV."));
            }
            https_1.default
                .get(targetUrl, (res) => {
                if (res.statusCode &&
                    res.statusCode >= 300 &&
                    res.statusCode < 400 &&
                    res.headers.location) {
                    getWithRedirect(res.headers.location, depth + 1);
                }
                else if (res.statusCode === 200) {
                    let data = "";
                    res.on("data", (chunk) => (data += chunk));
                    res.on("end", () => resolve(data));
                }
                else {
                    reject(new Error(`Gagal mengunduh spreadsheet, HTTP Status: ${res.statusCode} ${res.statusMessage}`));
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
function parseCSVLine(line) {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            }
            else {
                inQuotes = !inQuotes;
            }
        }
        else if (c === "," && !inQuotes) {
            result.push(cur.trim());
            cur = "";
        }
        else {
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
const syncManpowerFromSheet = async (req, res) => {
    try {
        const csvUrl = req.body?.csvUrl || exports.DEFAULT_HR_SPREADSHEET_CSV_URL;
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
                message: "Baris header tidak ditemukan. Pastikan sheet berisi kolom 'Employee ID' dan 'Full Name'.",
            });
        }
        const headers = parseCSVLine(lines[headerIdx]);
        const getVal = (row, name) => {
            const idx = headers.indexOf(name);
            if (idx === -1 || idx >= row.length)
                return null;
            const v = row[idx]?.trim();
            return v ? v : null;
        };
        // Prepare parsed list of valid employees
        const parsedRecords = [];
        for (let r = headerIdx + 1; r < lines.length; r++) {
            const row = parseCSVLine(lines[r]);
            const employeeId = getVal(row, "Employee ID");
            const fullName = getVal(row, "Full Name");
            if (!employeeId || !fullName)
                continue;
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
        const errors = [];
        // Process concurrently in chunks of 25 records for high speed
        const chunkSize = 25;
        for (let i = 0; i < parsedRecords.length; i += chunkSize) {
            const chunk = parsedRecords.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async ({ employeeId, payload }) => {
                try {
                    const existing = await prisma_1.prisma.masterManpower.findUnique({
                        where: { employeeId },
                        select: { id: true },
                    });
                    if (existing) {
                        await prisma_1.prisma.masterManpower.update({
                            where: { employeeId },
                            data: payload,
                        });
                        updated++;
                    }
                    else {
                        await prisma_1.prisma.masterManpower.create({
                            data: {
                                employeeId,
                                ...payload,
                            },
                        });
                        inserted++;
                    }
                }
                catch (err) {
                    errors.push(`Gagal memproses ${employeeId}: ${err.message}`);
                }
            }));
        }
        const totalProcessed = inserted + updated;
        console.log(`[HR Sync] Selesai. Total: ${totalProcessed}, Baru: ${inserted}, Diperbarui: ${updated}`);
        return res.json({
            success: true,
            message: `Sinkronisasi berhasil! ${totalProcessed} data karyawan diproses (${inserted} baru, ${updated} diperbarui).`,
            total: totalProcessed,
            inserted,
            updated,
            lastSync: new Date().toISOString(),
            errors: errors.slice(0, 5),
        });
    }
    catch (error) {
        console.error("[HR Sync] Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Gagal menyinkronkan data manpower dari Google Spreadsheet.",
        });
    }
};
exports.syncManpowerFromSheet = syncManpowerFromSheet;
/**
 * GET /api/manpower
 * Fetch paginated manpower records with filtering
 */
const getManpowerList = async (req, res) => {
    try {
        const { search, statusKeaktifan, branchName, organization, statusEmployee, pointOfHire, page = "1", limit = "25", sortBy = "fullName", sortOrder = "asc", } = req.query;
        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const limitNum = Math.min(200, Math.max(5, parseInt(String(limit)) || 25));
        const skip = (pageNum - 1) * limitNum;
        const where = {};
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
            prisma_1.prisma.masterManpower.count({ where }),
            prisma_1.prisma.masterManpower.findMany({
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
    }
    catch (error) {
        console.error("[Get Manpower List] Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Gagal mengambil daftar manpower.",
        });
    }
};
exports.getManpowerList = getManpowerList;
/**
 * GET /api/manpower/stats
 * Aggregate metrics and demographics for Dashboard and Master Manpower
 */
const getManpowerStats = async (req, res) => {
    try {
        const [totalAll, totalExist, totalExit, allRecords] = await Promise.all([
            prisma_1.prisma.masterManpower.count(),
            prisma_1.prisma.masterManpower.count({
                where: { statusKeaktifan: { equals: "Exist", mode: "insensitive" } },
            }),
            prisma_1.prisma.masterManpower.count({
                where: { statusKeaktifan: { equals: "Exit", mode: "insensitive" } },
            }),
            prisma_1.prisma.masterManpower.findMany({
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
        const branchMap = {};
        const orgMap = {};
        const statusEmpMap = {};
        const pohMap = {};
        let latestUpdate = null;
        allRecords.forEach((r) => {
            const b = r.branchName?.trim() || "Lainnya";
            if (!branchMap[b])
                branchMap[b] = { total: 0, exist: 0, exit: 0 };
            branchMap[b].total++;
            if (r.statusKeaktifan?.toLowerCase() === "exist")
                branchMap[b].exist++;
            else
                branchMap[b].exit++;
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
                lastSync: latestUpdate ? latestUpdate.toISOString() : null,
            },
        });
    }
    catch (error) {
        console.error("[Get Manpower Stats] Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Gagal mengambil statistik manpower.",
        });
    }
};
exports.getManpowerStats = getManpowerStats;
/**
 * GET /api/manpower/:id
 * Get full dossier of a single manpower
 */
const getManpowerById = async (req, res) => {
    try {
        const { id } = req.params;
        const record = await prisma_1.prisma.masterManpower.findFirst({
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
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Gagal mengambil detail karyawan.",
        });
    }
};
exports.getManpowerById = getManpowerById;
