import * as XLSX from "xlsx";

export interface ParsedGLExpenseSummary {
  accountCode: string;
  accountName: string;
  hofAmount: number;
  mphAmount: number;
  snyAmount: number;
  grandTotal: number;
}

export interface ParsedGLTransaction {
  date: string;
  regNo?: string;
  controlNo?: string;
  accountCode: string;
  accountName: string;
  accountGroup?: string;
  currency: string;
  costCenter?: string;
  debet: number;
  credit: number;
  saldo?: number;
  projectArea?: string; // "MPH", "SNY", "HOF"
  materialCode?: string;
  specification?: string;
  qty?: number;
  supplierName?: string;
  remark?: string;
}

export interface ParsedGLResult {
  fileName: string;
  periodName: string;
  startDate?: string;
  endDate?: string;
  year: number;
  month: number;
  totalDebet: number;
  totalCredit: number;
  totalTransactions: number;
  siteTotals: {
    HOF: number;
    MPH: number;
    SNY: number;
    grandTotal: number;
  };
  reconciliationMatch: boolean;
  discrepancy: number;
  summaries: ParsedGLExpenseSummary[];
  transactions: ParsedGLTransaction[];
}

function formatDate(val: any): string {
  if (!val) return "";
  if (typeof val === "number") {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) {
      const y = parsed.y;
      const m = String(parsed.m).padStart(2, "0");
      const d = String(parsed.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  if (typeof val === "string") {
    const match = val.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (match) {
      let yr = parseInt(match[3], 10);
      if (yr < 100) yr += 2000;
      return `${yr}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    }
    return val.trim();
  }
  return "";
}

export function parseGLExcel(buffer: Buffer, fileName: string): ParsedGLResult {
  const wb = XLSX.read(buffer, { type: "buffer" });

  const sheet1Name = wb.SheetNames.find((s) => s.toLowerCase() === "sheet1") || wb.SheetNames[0];
  const sheet2Name = wb.SheetNames.find((s) => s.toLowerCase() === "sheet2") || (wb.SheetNames.length > 1 ? wb.SheetNames[1] : null);

  if (!sheet1Name) {
    throw new Error("Sheet1 (Data General Ledger) tidak ditemukan dalam file Excel.");
  }

  const ws1 = wb.Sheets[sheet1Name];
  const data1: any[][] = XLSX.utils.sheet_to_json(ws1, { header: 1 });

  // 1. Detect Period Header
  // e.g. Row 1: ["PERIODE 01/10/26 To 23/10/26"]
  let rawPeriodText = "";
  for (let i = 0; i < Math.min(5, data1.length); i++) {
    const row = data1[i];
    if (row && row[0] && String(row[0]).toUpperCase().includes("PERIODE")) {
      rawPeriodText = String(row[0]).trim();
      break;
    }
  }

  let periodName = rawPeriodText || "Periode Tidak Diketahui";
  let startDateStr: string | undefined;
  let endDateStr: string | undefined;
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;

  // Regex parse: PERIODE 01/10/26 To 23/10/26
  const periodMatch = rawPeriodText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+to\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i);
  if (periodMatch) {
    const sDay = periodMatch[1].padStart(2, "0");
    const sMonth = periodMatch[2].padStart(2, "0");
    let sYear = parseInt(periodMatch[3], 10);
    if (sYear < 100) sYear += 2000;

    const eDay = periodMatch[4].padStart(2, "0");
    const eMonth = periodMatch[5].padStart(2, "0");
    let eYear = parseInt(periodMatch[6], 10);
    if (eYear < 100) eYear += 2000;

    startDateStr = `${sYear}-${sMonth}-${sDay}`;
    endDateStr = `${eYear}-${eMonth}-${eDay}`;
    year = eYear;
    month = parseInt(eMonth, 10);
  }

  // 2. Parse Sheet2 (Kode Beban Summary) if available
  const summaries: ParsedGLExpenseSummary[] = [];
  let s2GrandTotal = 0;
  let s2HofTotal = 0;
  let s2MphTotal = 0;
  let s2SnyTotal = 0;

  if (sheet2Name && wb.Sheets[sheet2Name]) {
    const ws2 = wb.Sheets[sheet2Name];
    const data2: any[][] = XLSX.utils.sheet_to_json(ws2, { header: 1 });

    // Expect Row 1 headers: Row Labels, HOF, MPH, SNY, Grand Total
    for (let i = 2; i < data2.length; i++) {
      const row = data2[i];
      if (!row || row.length === 0) continue;
      const label = String(row[0] || "").trim();
      if (!label || label.toLowerCase().includes("grand total")) {
        if (label.toLowerCase().includes("grand total")) {
          s2HofTotal = Number(row[1] || 0);
          s2MphTotal = Number(row[2] || 0);
          s2SnyTotal = Number(row[3] || 0);
          s2GrandTotal = Number(row[4] || 0);
        }
        continue;
      }

      let accountCode = "";
      let accountName = label;
      const match = label.match(/^([0-9A-Za-z\.\-]+)\s*[-:]\s*(.+)$/);
      if (match) {
        accountCode = match[1].trim();
        accountName = match[2].trim();
      } else {
        accountCode = label.split(" ")[0].trim();
      }

      const hof = Number(row[1] || 0);
      const mph = Number(row[2] || 0);
      const sny = Number(row[3] || 0);
      const total = Number(row[4] || hof + mph + sny);

      summaries.push({
        accountCode,
        accountName,
        hofAmount: hof,
        mphAmount: mph,
        snyAmount: sny,
        grandTotal: total,
      });
    }
  }

  // 3. Parse Sheet1 (GL Transactions)
  const transactions: ParsedGLTransaction[] = [];
  let totalDebet = 0;
  let totalCredit = 0;

  for (let i = 4; i < data1.length; i++) {
    const row = data1[i];
    if (!row || row.length === 0) continue;

    const costCenter = String(row[6] || "").trim();
    const remark = String(row[21] || "").trim();
    if (costCenter.toLowerCase() === "summary") continue;
    if (remark.toLowerCase() === "saldo awal") continue;

    const rawNoAccount = String(row[3] || "").trim();
    if (!rawNoAccount) continue;

    let accountCode = "";
    let accountName = rawNoAccount;
    const match = rawNoAccount.match(/^([0-9A-Za-z\.\-]+)\s*[-:]\s*(.+)$/);
    if (match) {
      accountCode = match[1].trim();
      accountName = match[2].trim();
    } else {
      accountCode = rawNoAccount.split(" ")[0].trim();
    }

    const dateStr = formatDate(row[0]);
    const regNo = row[1] ? String(row[1]).trim() : undefined;
    const controlNo = row[2] ? String(row[2]).trim() : undefined;
    const accountGroup = row[4] ? String(row[4]).trim() : undefined;
    const currency = row[5] ? String(row[5]).trim() : "IDR";
    const debet = Number(row[9] || 0);
    const credit = Number(row[10] || 0);
    const saldo = row[11] !== undefined && row[11] !== null ? Number(row[11]) : undefined;
    const projectArea = row[15] ? String(row[15]).trim().toUpperCase() : undefined;
    const materialCode = row[16] ? String(row[16]).trim() : undefined;
    const specification = row[17] ? String(row[17]).trim() : undefined;
    const qty = row[18] !== undefined && row[18] !== null ? Number(row[18]) : undefined;
    const supplierName = row[20] ? String(row[20]).trim() : undefined;

    totalDebet += debet;
    totalCredit += credit;

    transactions.push({
      date: dateStr,
      regNo,
      controlNo,
      accountCode,
      accountName,
      accountGroup,
      currency,
      costCenter: costCenter || undefined,
      debet,
      credit,
      saldo,
      projectArea,
      materialCode,
      specification,
      qty,
      supplierName,
      remark: remark || undefined,
    });
  }

  // Calculate totals per site from Sheet1 if Sheet2 grand totals were 0
  let hofTotal = s2HofTotal;
  let mphTotal = s2MphTotal;
  let snyTotal = s2SnyTotal;
  let grandTotal = s2GrandTotal;

  if (grandTotal === 0) {
    transactions.forEach((t) => {
      if (t.projectArea === "HOF") hofTotal += t.debet;
      else if (t.projectArea === "MPH") mphTotal += t.debet;
      else if (t.projectArea === "SNY") snyTotal += t.debet;
    });
    grandTotal = totalDebet;
  }

  // Check reconciliation match
  const discrepancy = Math.abs(grandTotal - totalDebet);
  const reconciliationMatch = discrepancy < 0.01;

  return {
    fileName,
    periodName,
    startDate: startDateStr,
    endDate: endDateStr,
    year,
    month,
    totalDebet,
    totalCredit,
    totalTransactions: transactions.length,
    siteTotals: {
      HOF: hofTotal,
      MPH: mphTotal,
      SNY: snyTotal,
      grandTotal,
    },
    reconciliationMatch,
    discrepancy,
    summaries,
    transactions,
  };
}
