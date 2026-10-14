import * as xlsx from "xlsx";
import * as path from "path";

const filePath = path.resolve(__dirname, "../../10.26 - Lap Keu BDP 1 Update - YTD Oktober 2026 Site.xlsx");
const wb = xlsx.readFile(filePath);

console.log("Sheet names:", wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  if (sheetName.toLowerCase().includes("summary")) {
    console.log("\n================ SHEET:", sheetName, "================");
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1 });
    for (let r = 0; r < Math.min(30, data.length); r++) {
      if (data[r] && data[r].some((cell: any) => cell !== undefined && cell !== null && cell !== "")) {
        console.log(`R${r + 1}:`, JSON.stringify(data[r].slice(0, 20)));
      }
    }
  }
}
