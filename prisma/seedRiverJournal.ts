import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Neither DIRECT_URL nor DATABASE_URL is defined.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const senyiurRaw = [
  [1,"2026-09-02","10:33","Dermaga Senyiur KM 0",2.11,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [2,"2026-09-03","08:01","Dermaga Senyiur KM 0",2.06,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [3,"2026-09-04","00:01","Dermaga Senyiur KM 0",2.02,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [4,"2026-09-05","01:01","Dermaga Senyiur KM 0",1.98,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [5,"2026-09-06","02:01","Dermaga Senyiur KM 0",1.89,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [6,"2026-09-07","03:01","Dermaga Senyiur KM 0",2.10,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [7,"2026-09-08","04:01","Dermaga Senyiur KM 0",2.05,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [8,"2026-09-09","05:01","Dermaga Senyiur KM 0",2.01,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [9,"2026-09-10","06:01","Dermaga Senyiur KM 0",2.09,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [10,"2026-09-11","07:01","Dermaga Senyiur KM 0",1.98,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [11,"2026-09-12","08:01","Dermaga Senyiur KM 0",2.07,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [12,"2026-09-13","09:01","Dermaga Senyiur KM 0",2.03,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [13,"2026-09-14","10:01","Dermaga Senyiur KM 0",2.06,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [14,"2026-09-15","11:01","Dermaga Senyiur KM 0",1.98,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [15,"2026-09-16","12:01","Dermaga Senyiur KM 0",1.98,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [16,"2026-09-17","13:01","Dermaga Senyiur KM 0",1.95,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [17,"2026-09-18","14:01","Dermaga Senyiur KM 0",2.01,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [18,"2026-09-19","15:01","Dermaga Senyiur KM 0",2.04,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [19,"2026-09-20","16:01","Dermaga Senyiur KM 0",2.09,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [20,"2026-09-21","17:01","Dermaga Senyiur KM 0",2.03,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [21,"2026-09-22","18:01","Dermaga Senyiur KM 0",1.99,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [22,"2026-09-23","19:01","Dermaga Senyiur KM 0",1.98,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [23,"2026-09-24","20:01","Dermaga Senyiur KM 0",1.98,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [24,"2026-09-25","21:01","Dermaga Senyiur KM 0",1.88,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [25,"2026-09-26","07:01","Dermaga Senyiur KM 0",1.92,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [26,"2026-09-27","08:01","Dermaga Senyiur KM 0",1.97,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [27,"2026-09-28","09:01","Dermaga Senyiur KM 0",1.90,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [28,"2026-09-29","10:01","Dermaga Senyiur KM 0",2.04,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [29,"2026-09-30","11:01","Dermaga Senyiur KM 0",2.15,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [30,"2026-10-01","12:01","Dermaga Senyiur KM 0",2.36,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [31,"2026-10-02","13:01","Dermaga Senyiur KM 0",2.35,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [32,"2026-10-03","14:01","Dermaga Senyiur KM 0",2.14,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [33,"2026-10-04","15:01","Dermaga Senyiur KM 0",1.80,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [34,"2026-10-05","16:01","Dermaga Senyiur KM 0",1.76,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [35,"2026-10-06","17:01","Dermaga Senyiur KM 0",1.86,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [36,"2026-10-07","18:01","Dermaga Senyiur KM 0",1.86,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [37,"2026-10-08","19:01","Dermaga Senyiur KM 0",2.06,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [38,"2026-10-09","20:01","Dermaga Senyiur KM 0",1.98,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [39,"2026-10-10","21:01","Dermaga Senyiur KM 0",2.00,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [40,"2026-10-11","22:01","Dermaga Senyiur KM 0",2.01,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [41,"2026-10-12","23:01","Dermaga Senyiur KM 0",2.00,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [42,"2026-10-13","00:01","Dermaga Senyiur KM 0",2.00,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [43,"2026-10-14","01:01","Dermaga Senyiur KM 0",2.74,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
  [44,"2026-10-15","02:01","Dermaga Senyiur KM 0",2.48,4,"Surut (Tugboat Tidak Bisa Masuk)","Dzaky","Kondisi air sungai masih surut, tugboat belum bisa masuk ke sungai."],
];

const muaraPahuRaw = [
  [1,"2026-09-21","08:00","Jetty Muara Pahu",8.06,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [2,"2026-09-22","09:00","Jetty Muara Pahu",8.06,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [3,"2026-09-23","10:00","Jetty Muara Pahu",7.48,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [4,"2026-09-24","11:00","Jetty Muara Pahu",7.52,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [5,"2026-09-25","12:00","Jetty Muara Pahu",7.80,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [6,"2026-09-26","13:00","Jetty Muara Pahu",7.80,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [7,"2026-09-27","14:00","Jetty Muara Pahu",7.80,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [8,"2026-09-28","15:00","Jetty Muara Pahu",7.90,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [9,"2026-09-29","16:00","Jetty Muara Pahu",7.90,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [10,"2026-09-30","17:00","Jetty Muara Pahu",8.55,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [11,"2026-10-01","18:00","Jetty Muara Pahu",8.70,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [12,"2026-10-02","19:00","Jetty Muara Pahu",8.60,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [13,"2026-10-03","20:00","Jetty Muara Pahu",8.25,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [14,"2026-10-04","21:00","Jetty Muara Pahu",8.20,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [15,"2026-10-05","22:00","Jetty Muara Pahu",7.08,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [16,"2026-10-06","23:00","Jetty Muara Pahu",7.40,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [17,"2026-10-07","00:00","Jetty Muara Pahu",7.60,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [18,"2026-10-08","01:00","Jetty Muara Pahu",7.73,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [19,"2026-10-09","02:00","Jetty Muara Pahu",8.40,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [20,"2026-10-10","03:00","Jetty Muara Pahu",8.10,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [21,"2026-10-11","04:00","Jetty Muara Pahu",8.12,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [22,"2026-10-12","05:00","Jetty Muara Pahu",8.08,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [23,"2026-10-13","06:00","Jetty Muara Pahu",8.40,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [24,"2026-10-14","07:00","Jetty Muara Pahu",9.40,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
  [25,"2026-10-15","08:00","Jetty Muara Pahu",8.70,4,"Air Sudah Aman","Dzaky","Operasional Lancar"],
];

async function seed() {
  console.log("Seeding River Journal data from Google Sheets...");

  // Check existing count
  const count = await prisma.riverJournal.count();
  console.log(`Current RiverJournal count: ${count}`);

  if (count === 0) {
    // Seed Senyiur
    for (const row of senyiurRaw) {
      await prisma.riverJournal.create({
        data: {
          externalId: Number(row[0]),
          date: String(row[1]),
          inputTime: String(row[2]),
          location: String(row[3]),
          site: "Senyiur",
          waterDepth: Number(row[4]),
          minThreshold: Number(row[5]),
          autoDescription: String(row[6]),
          userInput: String(row[7]),
          conclusion: String(row[8]),
        },
      });
    }
    console.log(`Seeded ${senyiurRaw.length} Senyiur records.`);

    // Seed Muara Pahu
    for (const row of muaraPahuRaw) {
      await prisma.riverJournal.create({
        data: {
          externalId: Number(row[0]),
          date: String(row[1]),
          inputTime: String(row[2]),
          location: String(row[3]),
          site: "MuaraPahu",
          waterDepth: Number(row[4]),
          minThreshold: Number(row[5]),
          autoDescription: String(row[6]),
          userInput: String(row[7]),
          conclusion: String(row[8]),
        },
      });
    }
    console.log(`Seeded ${muaraPahuRaw.length} Muara Pahu records.`);
  } else {
    console.log("RiverJournal records already exist, skipping initial seed.");
  }

  const finalCount = await prisma.riverJournal.count();
  console.log(`Total RiverJournal records now: ${finalCount}`);
}

seed()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
