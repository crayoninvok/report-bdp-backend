import { prisma } from "../src/lib/prisma";

// 6 Prime Mover units that are NOT in the Muara Pahu PI schedule table -> Senyiur
export const SENYIUR_HEAD_CODES = new Set([
  "PM403",
  "PM407",
  "PM418",
  "PM421",
  "PM446",
  "PM451",
]);

// Official Weekly PI Schedule for Muara Pahu (65 Prime Movers)
export const MUARA_PAHU_WEEKLY_PI: Record<number, string[]> = {
  0: ["PM456", "PM457", "PM458", "PM459", "PM460", "PM461", "PM462", "PM463", "PM464"], // Senin (9)
  1: ["PM406", "PM413", "PM465", "PM466", "PM467", "PM468", "PM469", "PM470", "PM471"], // Selasa (9)
  2: ["PM401", "PM402", "PM404", "PM405", "PM408", "PM409", "PM410", "PM411", "PM412"], // Rabu (9)
  3: ["PM414", "PM415", "PM416", "PM417", "PM419", "PM420", "PM422", "PM423", "PM425"], // Kamis (9)
  4: ["PM426", "PM427", "PM429", "PM430", "PM431", "PM432", "PM433", "PM434", "PM435", "PM424"], // Jumat (10)
  5: ["PM436", "PM437", "PM438", "PM439", "PM440", "PM441", "PM442", "PM443", "PM444"], // Sabtu (9)
  6: ["PM445", "PM447", "PM448", "PM449", "PM450", "PM452", "PM453", "PM454", "PM455", "PM428"], // Minggu (10)
};

/**
 * Returns array of 7 dates (YYYY-MM-DD) for Monday through Sunday of the given reference date
 */
function getCurrentWeekDates(refDate: Date = new Date()): string[] {
  const day = refDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + diffToMonday);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

async function seedMasterUnits() {
  console.log("==================================================");
  console.log("SEEDING MASTER UNITS & PI SCHEDULE");
  console.log("==================================================");

  // 1. Seed Global Plant Setting: daily_pi_target = 9
  await prisma.plantSetting.upsert({
    where: { key: "daily_pi_target" },
    update: {},
    create: {
      key: "daily_pi_target",
      value: "9",
      description: "Target plan harian Periodic Inspection (PI) unit",
      jobSite: "MuaraPahu",
    },
  });
  console.log("✓ PlantSetting 'daily_pi_target' verified/seeded (value: 9)");

  // 2. Build 284 Master Units (71 Combinations x 4 Units)
  const totalCombinations = 71;
  const unitsToUpsert: Array<{
    unitCode: string;
    unitNumber: number;
    category: string;
    brand: string;
    model: string;
    headUnitCode: string;
    pairIndex: number;
    jobSite: "MuaraPahu" | "Senyiur";
  }> = [];

  for (let i = 1; i <= totalCombinations; i++) {
    const headCode = `PM${400 + i}`; // PM401 - PM471
    // PM403, PM407, PM418, PM421, PM446, PM451 are at Senyiur, all others at Muara Pahu
    const unitSite: "MuaraPahu" | "Senyiur" = SENYIUR_HEAD_CODES.has(headCode)
      ? "Senyiur"
      : "MuaraPahu";

    // 1. Prime Mover (Head)
    unitsToUpsert.push({
      unitCode: headCode,
      unitNumber: 400 + i,
      category: "Prime Mover",
      brand: "Volvo",
      model: "FH16",
      headUnitCode: headCode,
      pairIndex: i,
      jobSite: unitSite,
    });

    // 2. Vessel 1
    unitsToUpsert.push({
      unitCode: `ST${800 + i}`, // ST801 - ST871
      unitNumber: 800 + i,
      category: "Vessel 1",
      brand: "Korindo",
      model: "SDT110",
      headUnitCode: headCode,
      pairIndex: i,
      jobSite: unitSite,
    });

    // 3. Dolly
    unitsToUpsert.push({
      unitCode: `DL${600 + i}`, // DL601 - DL671
      unitNumber: 600 + i,
      category: "Dolly",
      brand: "Korindo",
      model: "DL",
      headUnitCode: headCode,
      pairIndex: i,
      jobSite: unitSite,
    });

    // 4. Vessel 2
    unitsToUpsert.push({
      unitCode: `ST${900 + i}`, // ST901 - ST971
      unitNumber: 900 + i,
      category: "Vessel 2",
      brand: "Korindo",
      model: "SDT125",
      headUnitCode: headCode,
      pairIndex: i,
      jobSite: unitSite,
    });
  }

  console.log(`Starting upsert of ${unitsToUpsert.length} master units...`);

  let count = 0;
  for (const unit of unitsToUpsert) {
    await prisma.masterUnit.upsert({
      where: { unitCode: unit.unitCode },
      update: {
        unitNumber: unit.unitNumber,
        category: unit.category,
        brand: unit.brand,
        model: unit.model,
        headUnitCode: unit.headUnitCode,
        pairIndex: unit.pairIndex,
        jobSite: unit.jobSite,
      },
      create: {
        unitCode: unit.unitCode,
        unitNumber: unit.unitNumber,
        category: unit.category,
        brand: unit.brand,
        model: unit.model,
        headUnitCode: unit.headUnitCode,
        pairIndex: unit.pairIndex,
        jobSite: unit.jobSite,
        status: "Active",
      },
    });
    count++;
  }

  console.log(`✓ Successfully updated/seeded ${count} units in MasterUnit!`);

  // Print Summary by Site
  const mpHeadCount = await prisma.masterUnit.count({
    where: { category: "Prime Mover", jobSite: "MuaraPahu" },
  });
  const mpTotalCount = await prisma.masterUnit.count({
    where: { jobSite: "MuaraPahu" },
  });

  const snyHeadCount = await prisma.masterUnit.count({
    where: { category: "Prime Mover", jobSite: "Senyiur" },
  });
  const snyTotalCount = await prisma.masterUnit.count({
    where: { jobSite: "Senyiur" },
  });

  console.log("--------------------------------------------------");
  console.log(`Site Muara Pahu : ${mpHeadCount} Head Units (${mpTotalCount} Total Units)`);
  console.log(`Site Senyiur    : ${snyHeadCount} Head Units (${snyTotalCount} Total Units)`);
  console.log(`Senyiur PMs     : ${Array.from(SENYIUR_HEAD_CODES).join(", ")}`);
  console.log("--------------------------------------------------");

  // 3. Seed Current Week's PI Schedule for Muara Pahu
  const weekDates = getCurrentWeekDates();
  console.log(`Seeding Periodic Inspection for current week: ${weekDates[0]} s/d ${weekDates[6]}`);

  let totalScheduled = 0;
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const curDate = weekDates[dayIdx];
    const unitList = MUARA_PAHU_WEEKLY_PI[dayIdx] || [];
    const dailyTarget = unitList.length; // 9 or 10

    // Upsert Plan for this day
    const plan = await prisma.periodicInspectionPlan.upsert({
      where: {
        jobSite_date: {
          jobSite: "MuaraPahu",
          date: curDate,
        },
      },
      update: {
        targetUnits: dailyTarget,
      },
      create: {
        jobSite: "MuaraPahu",
        date: curDate,
        targetUnits: dailyTarget,
      },
    });

    // Upsert items for this day
    for (const unitCode of unitList) {
      // Find trailers for buntutSummary
      const i = parseInt(unitCode.replace("PM", ""), 10) - 400;
      const buntutSummary = `ST${800 + i}, DL${600 + i}, ST${900 + i}`;

      await prisma.periodicInspectionItem.upsert({
        where: {
          planId_unitCode: {
            planId: plan.id,
            unitCode,
          },
        },
        update: {
          date: curDate,
          buntutSummary,
        },
        create: {
          planId: plan.id,
          date: curDate,
          unitCode,
          serviceType: "PI Regular",
          shift: "Shift 1",
          status: "Scheduled",
          buntutSummary,
        },
      });
      totalScheduled++;
    }
  }

  console.log(`✓ Successfully seeded ${totalScheduled} PI units for the current week!`);
  console.log("==================================================");
}

seedMasterUnits()
  .catch((err) => {
    console.error("Error seeding master units & PI schedule:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
