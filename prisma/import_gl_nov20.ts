import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { parseGLExcel } from "../src/lib/glParser";

async function main() {
  console.log("==========================================================");
  console.log("IMPORTING GL PRODUKSI NOV 2026 (20112026)");
  console.log("==========================================================");

  const filePath = path.resolve(__dirname, "../../GL Produksi Nov 2026 ( 20112026).xls");
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const parsed = parseGLExcel(buffer, "GL Produksi Nov 2026 ( 20112026).xls");

  console.log(`Period Name   : ${parsed.periodName}`);
  console.log(`Dates         : ${parsed.startDate} to ${parsed.endDate}`);
  console.log(`Total Trx     : ${parsed.totalTransactions.toLocaleString()}`);
  console.log(`Total Debet   : Rp ${parsed.totalDebet.toLocaleString()}`);
  console.log(`Summaries     : ${parsed.summaries.length} accounts`);
  console.log(`Site Totals   :`, parsed.siteTotals);

  const savedPeriod = await prisma.$transaction(
    async (tx) => {
      // 1. Clean existing record for this periodName
      const existing = await tx.gLPeriod.findFirst({
        where: {
          year: parsed.year,
          month: parsed.month,
          periodName: parsed.periodName,
        },
      });

      if (existing) {
        console.log(`Replacing existing period ID: ${existing.id}...`);
        await tx.gLPeriod.delete({ where: { id: existing.id } });
      }

      // 2. Create GLPeriod
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
      console.log(`Created GLPeriod ID: ${period.id}`);

      // 3. Batch insert summaries
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
        console.log(`  ✔ Inserted ${parsed.summaries.length} expense summaries.`);
      }

      // 4. Batch insert transactions in chunks of 1500
      const CHUNK_SIZE = 1500;
      let insertedCount = 0;
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
        insertedCount += chunk.length;
        console.log(`  ✔ Inserted chunk: ${insertedCount} / ${parsed.transactions.length} transactions`);
      }

      return period;
    },
    {
      maxWait: 20000,
      timeout: 180000,
    }
  );

  console.log("\n==========================================================");
  console.log(`SUCCESSFULLY IMPORTED GL PERIOD: ${savedPeriod.periodName}`);
  console.log("==========================================================");
}

main()
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
