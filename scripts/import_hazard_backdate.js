const { Client } = require("pg");
const xlsx = require("../../frontend/node_modules/xlsx");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });

// Helper to convert Excel date serial to YYYY-MM-DD
function parseExcelDate(val) {
  if (!val) return new Date().toISOString().slice(0, 10);
  if (typeof val === "number") {
    // Excel date serial
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Try parsing DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    } else {
      // DD-MM-YYYY
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  return str.slice(0, 10);
}

// Custom manual overrides for known typos/swapped columns in Excel
const KNOWN_OVERRIDES = {
  // Swapped columns or typos: rawKey -> { nrp, name }
  "adi setyowanyo|98251094": { nrp: "98250194", name: "Adi Setyowanto" },
  "98250194|adi setyowanto": { nrp: "98250194", name: "Adi Setyowanto" },
  "ha|petrus b": { nrp: "98240012", name: "Petrus Beribe" },
  "aldian|o8250326": { nrp: "98250326", name: "Aldian Syahroni" },
  "aldian|9i250326": { nrp: "98250326", name: "Aldian Syahroni" },
  "98250151|joko sudarno": { nrp: "98250151", name: "Joko Sudarno" },
  "armansyaj|98260592": { nrp: "88260592", name: "Armansyah" },
  "riko|99250301": { nrp: "98250301", name: "Riko Fernando" },
  "98240021|suprapto": { nrp: "98240021", name: "Suprapto" },
  "98260594|danendra anindya": { nrp: "98260594", name: "Danendra Anindya Yafi Widhiwipati" },
  "bambang h|9825110": { nrp: "98250110", name: "Bambang Hermanto" },
  "bambang h|9826110": { nrp: "98250110", name: "Bambang Hermanto" },
  "98250363|98250363": { nrp: "98250363", name: "Frans Maurietz" },
};

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("Connected to Supabase PostgreSQL.");

  // 1. Create table HazardReport if not exists
  console.log("Checking / Creating HazardReport table...");
  await client.query(`
    CREATE TABLE IF NOT EXISTS "HazardReport" (
      "id" TEXT NOT NULL,
      "reportNumber" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "time" TEXT,
      "jobSite" "JobSite" NOT NULL DEFAULT 'MuaraPahu',
      "project" TEXT NOT NULL,
      "location" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "riskLevel" TEXT NOT NULL DEFAULT 'Medium',
      "title" TEXT NOT NULL,
      "description" TEXT,
      "immediateAction" TEXT,
      "correctiveAction" TEXT,
      "reporterName" TEXT NOT NULL,
      "reporterNrp" TEXT,
      "reporterDept" TEXT,
      "reporterJobTitle" TEXT,
      "picName" TEXT,
      "picDept" TEXT,
      "dueDate" TIMESTAMP(3),
      "completionDate" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'Open',
      "statusGForm" TEXT NOT NULL DEFAULT 'OPEN',
      "jenisPelaporan" TEXT NOT NULL DEFAULT 'KTA',
      "lokasiBahaya" TEXT,
      "identifikasiBahaya" TEXT,
      "rincianBahaya" TEXT,
      "tindakanPerbaikan" TEXT,
      "penanggungJawabArea" TEXT,
      "dokumentasiSebelum" TEXT,
      "dokumentasiSesudah" TEXT,
      "month" INTEGER,
      "week" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "HazardReport_pkey" PRIMARY KEY ("id")
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "HazardReport_reportNumber_key" ON "HazardReport"("reportNumber");
    CREATE INDEX IF NOT EXISTS "HazardReport_jobSite_date_idx" ON "HazardReport"("jobSite", "date");
    CREATE INDEX IF NOT EXISTS "HazardReport_statusGForm_idx" ON "HazardReport"("statusGForm");
    CREATE INDEX IF NOT EXISTS "HazardReport_reporterNrp_idx" ON "HazardReport"("reporterNrp");
  `);
  console.log("HazardReport table is ready.");

  // 2. Fetch MasterManpower for cross-matching
  const mpRes = await client.query('SELECT "employeeId", "fullName", organization, "jobPosition", "jobLevel", "branchName" FROM "MasterManpower";');
  const allManpower = mpRes.rows;
  console.log(`Loaded ${allManpower.length} MasterManpower records from DB.`);

  const byNrp = new Map();
  const byName = new Map();
  allManpower.forEach((m) => {
    byNrp.set(String(m.employeeId || "").trim().toLowerCase(), m);
    byName.set(String(m.fullName || "").trim().toLowerCase(), m);
  });

  // 3. Read Hazard Backdate.xlsx
  console.log("Reading Hazard Backdate.xlsx...");
  const wb = xlsx.readFile("../Hazard Backdate.xlsx");
  const rawRows = xlsx.utils.sheet_to_json(wb.Sheets["Sheet1"]);
  console.log(`Found ${rawRows.length} rows in Excel.`);

  // 4. Sort rows chronologically by date
  const parsedRows = rawRows.map((r, originalIdx) => {
    const rawDateStr = parseExcelDate(r["TANGGAL PELAPORAN"]);
    const rawName = String(r["NAMA PELAPOR"] || "").trim();
    const rawNrp = String(r["NRP PELAPOR"] || "").trim();
    const rawDept = String(r["DEPARTEMEN PELAPOR"] || "").trim();
    const rawJabatan = String(r["JABATAN PELAPOR"] || "").trim();
    const rawProject = String(r["PROJECT (SENYIUR/MUARA PAHU)"] || "").trim().toUpperCase();
    const rawJenis = String(r["JENIS PELAPORAN BAHAYA"] || "").trim().toUpperCase();
    const rawStatus = String(r["STATUS"] || "OPEN").trim().toUpperCase();
    const rawLokasi = String(r["LOKASI BAHAYA"] || "WORKSHOP").trim().toUpperCase();
    const rawPic = String(r["PENANGGUNG JAWAB AREA"] || "PLANT").trim().toUpperCase();

    const rawRincian = String(r["RINCIAN LOKASI BAHAYA"] || "").trim();
    const ttaIdentifikasi = String(r["IDENTIFIKASI BAHAYA - DIISI SESUAI DENGAN JENIS PELAPORAN (TTA)"] || "").trim();
    const ttaTindakan = String(r["TINDAKAN PERBAIKAN YANG DIPERLUKAN (TTA)"] || "").trim();
    const ktaIdentifikasi = String(r["IDENTIFIKASI BAHAYA - DIISI SESUAI DENGAN JENIS PELAPORAN (KTA)"] || "").trim();
    const ktaTindakan = String(r["TINDAKAN PERBAIKAN YANG DIPERLUKAN (KTA)"] || "").trim();

    const identifikasi = rawJenis === "TTA"
      ? (ttaIdentifikasi || ktaIdentifikasi || rawRincian)
      : (ktaIdentifikasi || ttaIdentifikasi || rawRincian);

    const tindakan = rawJenis === "TTA"
      ? (ttaTindakan || ktaTindakan)
      : (ktaTindakan || ttaTindakan);

    const fotoSebelum = String(r["DOKUMENTASI SEBELUM"] || r["DOKUMENTASI SEBELUM2"] || "").trim();
    const fotoSesudah = String(r["DOKUMENTASI SESUDAH"] || r["DOKUMENTASI SESUDAH3"] || "").trim();

    const monthVal = typeof r["Month "] === "number" ? r["Month "] : parseInt(r["Month "]) || null;
    const weekVal = typeof r["Week"] === "number" ? r["Week"] : parseInt(r["Week"]) || null;

    return {
      originalIdx,
      dateStr: rawDateStr,
      rawName,
      rawNrp,
      rawDept,
      rawJabatan,
      rawProject,
      rawJenis,
      rawStatus,
      rawLokasi,
      rawPic,
      rawRincian,
      identifikasi,
      tindakan,
      fotoSebelum,
      fotoSesudah,
      monthVal,
      weekVal,
    };
  });

  // Sort by date ascending
  parsedRows.sort((a, b) => a.dateStr.localeCompare(b.dateStr) || a.originalIdx - b.originalIdx);

  // 5. Match with MasterManpower and construct DB records
  let mpCounter = 0;
  let syCounter = 0;
  const recordsToInsert = [];

  for (const r of parsedRows) {
    const isSenyiur =
      r.rawProject.includes("SENYIUR") ||
      r.rawProject === "SY" ||
      r.rawLokasi.includes("SENYIUR");
    const jobSite = isSenyiur ? "Senyiur" : "MuaraPahu";
    const project = isSenyiur ? "SENYIUR" : "MUARA PAHU";
    const sitePrefix = isSenyiur ? "SY" : "MP";

    if (isSenyiur) {
      syCounter++;
    } else {
      mpCounter++;
    }
    const currentCount = isSenyiur ? syCounter : mpCounter;
    const yearStr = r.dateStr.slice(0, 4) || "2026";
    const reportNumber = `HZ-${sitePrefix}-${yearStr}-${String(currentCount).padStart(4, "0")}`;

    // Matching Manpower
    const lookupKey = `${r.rawName.toLowerCase()}|${r.rawNrp.toLowerCase()}`;
    let matchedMp = null;

    // Check manual override
    if (KNOWN_OVERRIDES[lookupKey]) {
      const ov = KNOWN_OVERRIDES[lookupKey];
      matchedMp = byNrp.get(ov.nrp.toLowerCase()) || byName.get(ov.name.toLowerCase());
    }

    // Exact NRP match
    if (!matchedMp && byNrp.has(r.rawNrp.toLowerCase())) {
      matchedMp = byNrp.get(r.rawNrp.toLowerCase());
    }

    // Exact Name match
    if (!matchedMp && byName.has(r.rawName.toLowerCase())) {
      matchedMp = byName.get(r.rawName.toLowerCase());
    }

    // Partial name match
    if (!matchedMp) {
      const cleanName = r.rawName.toLowerCase();
      const candidates = allManpower.filter((m) => {
        const mName = m.fullName.toLowerCase();
        return (
          mName.includes(cleanName) ||
          cleanName.includes(mName) ||
          (cleanName.length > 5 && mName.startsWith(cleanName.slice(0, 5)))
        );
      });
      if (candidates.length === 1) {
        matchedMp = candidates[0];
      }
    }

    // Normalized Final Values
    const finalNrp = matchedMp ? matchedMp.employeeId : (r.rawNrp.replace(/[^0-9]/g, "") || r.rawNrp);
    const finalName = matchedMp ? matchedMp.fullName : r.rawName;
    const finalDept = matchedMp?.organization ? matchedMp.organization.toUpperCase() : (r.rawDept || "PRODUKSI");
    const finalJabatan = matchedMp?.jobPosition
      ? matchedMp.jobPosition.toUpperCase()
      : (r.rawJabatan || matchedMp?.jobLevel?.toUpperCase() || "WORKER");

    const jenisPelaporan = r.rawJenis === "TTA" ? "TTA" : "KTA";
    const statusGForm = r.rawStatus === "CLOSE" ? "CLOSE" : "OPEN";
    const status = statusGForm === "CLOSE" ? "Closed" : "Open";

    // Category mapping
    let category = jenisPelaporan === "TTA" ? "Unsafe Action" : "Unsafe Condition";
    if (r.rawLokasi === "TPS LB3" || r.rawLokasi === "OIL TRAP" || r.identifikasi.toLowerCase().includes("limbah") || r.identifikasi.toLowerCase().includes("ceceran oil")) {
      category = "Environmental";
    }

    // Risk Level estimation
    let riskLevel = "Medium";
    const textLower = (r.identifikasi + " " + r.rawRincian).toLowerCase();
    if (textLower.includes("ketinggian") || textLower.includes("kebakaran") || textLower.includes("karhutla") || textLower.includes("terbakar") || textLower.includes("tegangan tinggi")) {
      riskLevel = "Critical";
    } else if (textLower.includes("amblas") || textLower.includes("overspeed") || textLower.includes("patah") || textLower.includes("longsor") || textLower.includes("bocor")) {
      riskLevel = "High";
    } else if (textLower.includes("sampah") || textLower.includes("kotor") || textLower.includes("putung") || textLower.includes("tertata") || textLower.includes("sepatu")) {
      riskLevel = "Low";
    }

    const title = r.identifikasi || r.rawRincian || "Temuan Bahaya Lapangan";
    const description = r.rawRincian || r.identifikasi;
    const immediateAction = r.tindakan || "-";
    const correctiveAction = r.tindakan || "-";
    const completionDate = status === "Closed" ? new Date(`${r.dateStr}T17:00:00Z`) : null;
    const dueDate = new Date(new Date(r.dateStr).getTime() + 3 * 86400000);

    recordsToInsert.push({
      id: `hz-${jobSite.toLowerCase()}-${String(currentCount).padStart(5, "0")}`,
      reportNumber,
      date: new Date(`${r.dateStr}T08:00:00Z`),
      time: "08:00",
      jobSite,
      project,
      location: r.rawLokasi,
      category,
      riskLevel,
      title,
      description,
      immediateAction,
      correctiveAction,
      reporterName: finalName,
      reporterNrp: finalNrp,
      reporterDept: finalDept,
      reporterJobTitle: finalJabatan,
      picName: r.rawPic,
      picDept: r.rawPic,
      dueDate,
      completionDate,
      status,
      statusGForm,
      jenisPelaporan,
      lokasiBahaya: r.rawLokasi,
      identifikasiBahaya: r.identifikasi,
      rincianBahaya: r.rawRincian,
      tindakanPerbaikan: r.tindakan,
      penanggungJawabArea: r.rawPic,
      dokumentasiSebelum: r.fotoSebelum || null,
      dokumentasiSesudah: r.fotoSesudah || null,
      month: r.monthVal || parseInt(r.dateStr.slice(5, 7)),
      week: r.weekVal || 1,
    });
  }

  console.log(`Prepared ${recordsToInsert.length} records for database insertion.`);
  console.log(`- Muara Pahu: ${mpCounter}`);
  console.log(`- Senyiur: ${syCounter}`);

  // 6. Insert in chunks using parameterized query with ON CONFLICT DO UPDATE
  console.log("Upserting records into PostgreSQL database...");
  const CHUNK_SIZE = 100;
  let insertedCount = 0;

  for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
    const chunk = recordsToInsert.slice(i, i + CHUNK_SIZE);
    await client.query("BEGIN;");

    for (const item of chunk) {
      await client.query(
        `INSERT INTO "HazardReport" (
          "id", "reportNumber", "date", "time", "jobSite", "project", "location",
          "category", "riskLevel", "title", "description", "immediateAction", "correctiveAction",
          "reporterName", "reporterNrp", "reporterDept", "reporterJobTitle", "picName", "picDept",
          "dueDate", "completionDate", "status", "statusGForm", "jenisPelaporan",
          "lokasiBahaya", "identifikasiBahaya", "rincianBahaya", "tindakanPerbaikan",
          "penanggungJawabArea", "dokumentasiSebelum", "dokumentasiSesudah", "month", "week",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, NOW(), NOW()
        )
        ON CONFLICT ("reportNumber") DO UPDATE SET
          "date" = EXCLUDED."date",
          "jobSite" = EXCLUDED."jobSite",
          "project" = EXCLUDED."project",
          "location" = EXCLUDED."location",
          "category" = EXCLUDED."category",
          "riskLevel" = EXCLUDED."riskLevel",
          "title" = EXCLUDED."title",
          "description" = EXCLUDED."description",
          "immediateAction" = EXCLUDED."immediateAction",
          "correctiveAction" = EXCLUDED."correctiveAction",
          "reporterName" = EXCLUDED."reporterName",
          "reporterNrp" = EXCLUDED."reporterNrp",
          "reporterDept" = EXCLUDED."reporterDept",
          "reporterJobTitle" = EXCLUDED."reporterJobTitle",
          "picName" = EXCLUDED."picName",
          "picDept" = EXCLUDED."picDept",
          "status" = EXCLUDED."status",
          "statusGForm" = EXCLUDED."statusGForm",
          "jenisPelaporan" = EXCLUDED."jenisPelaporan",
          "lokasiBahaya" = EXCLUDED."lokasiBahaya",
          "identifikasiBahaya" = EXCLUDED."identifikasiBahaya",
          "rincianBahaya" = EXCLUDED."rincianBahaya",
          "tindakanPerbaikan" = EXCLUDED."tindakanPerbaikan",
          "penanggungJawabArea" = EXCLUDED."penanggungJawabArea",
          "dokumentasiSebelum" = EXCLUDED."dokumentasiSebelum",
          "dokumentasiSesudah" = EXCLUDED."dokumentasiSesudah",
          "month" = EXCLUDED."month",
          "week" = EXCLUDED."week",
          "updatedAt" = NOW();`,
        [
          item.id,
          item.reportNumber,
          item.date,
          item.time,
          item.jobSite,
          item.project,
          item.location,
          item.category,
          item.riskLevel,
          item.title,
          item.description,
          item.immediateAction,
          item.correctiveAction,
          item.reporterName,
          item.reporterNrp,
          item.reporterDept,
          item.reporterJobTitle,
          item.picName,
          item.picDept,
          item.dueDate,
          item.completionDate,
          item.status,
          item.statusGForm,
          item.jenisPelaporan,
          item.lokasiBahaya,
          item.identifikasiBahaya,
          item.rincianBahaya,
          item.tindakanPerbaikan,
          item.penanggungJawabArea,
          item.dokumentasiSebelum,
          item.dokumentasiSesudah,
          item.month,
          item.week,
        ]
      );
      insertedCount++;
    }

    await client.query("COMMIT;");
    console.log(`Inserted ${insertedCount} / ${recordsToInsert.length} records...`);
  }

  // 7. Verify count in DB
  const verifyRes = await client.query('SELECT count(*) FROM "HazardReport";');
  console.log(`\nSUCCESS! Database now contains ${verifyRes.rows[0].count} HazardReport rows!`);

  const statRes = await client.query(`
    SELECT "jobSite", "statusGForm", count(*) as total
    FROM "HazardReport"
    GROUP BY "jobSite", "statusGForm"
    ORDER BY "jobSite", "statusGForm";
  `);
  console.log("Stats breakdown in DB:", statRes.rows);

  await client.end();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
