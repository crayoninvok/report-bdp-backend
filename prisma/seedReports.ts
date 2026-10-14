import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding exact Week 29 (01-23 Jul), Week 30 (01-30 Jul), Week 31 (01-06 Agst), Week 32 (01-14 Agst), Week 33 (01-21 Agst), Week 34 (01-28 Agst), Week 35 (01-03 Sept), Week 36 (01-11 Sept), Week 37 (01-18 Sept), Week 38 (01-25 Sept), Week 39 (01-30 Sept), and Week 40 (01-08 Okt)...");

  // =========================================================================
  // -8. SITE SENYIUR - WEEK 29 (01-23 Jul 2026) - Exactly from Week 29 Image 1
  // =========================================================================
  const senyiurWeek29 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "Senyiur",
        year: 2026,
        weekNumber: 29,
      },
    },
    update: {
      periodName: "01-23 Jul 2026",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-23"),
      budgetProduksi: 551862,
      realisasiProduksi: 534555,
      ytdBudgetProduksi: 5190382,
      ytdRealisasiProduksi: 4555878,
      status: "Final",
    },
    create: {
      jobSite: "Senyiur",
      periodName: "01-23 Jul 2026",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-23"),
      year: 2026,
      weekNumber: 29,
      budgetProduksi: 551862,
      realisasiProduksi: 534555,
      ytdBudgetProduksi: 5190382,
      ytdRealisasiProduksi: 4555878,
      status: "Final",
    },
  });

  const senyiurWeek29Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 1566376144, r: 1800000000, yb: 17622266179, yr: 33650000000 },
    { name: "BEBAN CONSUMABLES", b: 9041858770, r: 13456851990, yb: 85040647354, yr: 121247160234 },
    { name: "BEBAN FUEL - PRODUCTION", b: 7517464164, r: 10029729901, yb: 70703384694, yr: 90135995207 },
    { name: "BEBAN TYRE", b: 1458364318, r: 2918174015, yb: 13716233444, yr: 25454415138 },
    { name: "BEBAN SUB KONTRAKTOR", b: 9265580197, r: 9231924871, yb: 85500000000, yr: 81000000000 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 8967632721, r: 4500000000, yb: 72000000000, yr: 67000000000 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 1166691454, r: 1161105484, yb: 10972986755, yr: 10839913992 },
    { name: "BEBAN SPAREPART", b: 875018591, r: 1033180791, yb: 8229740066, yr: 8842445277 },
    { name: "BEBAN TOOLS", b: 29167286, r: 6140103, yb: 274324669, yr: 238132676 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 374162776, r: 840000000, yb: 3017000670, yr: 4100000000 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 124720925, r: 191666667, yb: 1039000224, yr: 1550000000 },
    { name: "BEBAN MOBILISASI", b: 50326540, r: 65162839, yb: 430035177, yr: 1095000000 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 189944846, r: 44628504, yb: 1081141572, yr: 2603419445 },
  ];

  for (let i = 0; i < senyiurWeek29Items.length; i++) {
    const it = senyiurWeek29Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: senyiurWeek29.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: senyiurWeek29.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // -7. SITE SENYIUR - WEEK 30 (01-30 Jul 2026) - Exactly from Week 30 Image 1
  // =========================================================================
  const senyiurWeek30 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "Senyiur",
        year: 2026,
        weekNumber: 30,
      },
    },
    update: {
      periodName: "01-30 Jul 2026",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-30"),
      budgetProduksi: 719820,
      realisasiProduksi: 719058,
      ytdBudgetProduksi: 5358340,
      ytdRealisasiProduksi: 4740381,
      status: "Final",
    },
    create: {
      jobSite: "Senyiur",
      periodName: "01-30 Jul 2026",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-30"),
      year: 2026,
      weekNumber: 30,
      budgetProduksi: 719820,
      realisasiProduksi: 719058,
      ytdBudgetProduksi: 5358340,
      ytdRealisasiProduksi: 4740381,
      status: "Final",
    },
  });

  const senyiurWeek30Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 2177733821, r: 2350000000, yb: 19800000000, yr: 36000000000 },
    { name: "BEBAN CONSUMABLES", b: 11793728831, r: 17431404650, yb: 87792517414, yr: 125221712894 },
    { name: "BEBAN FUEL - PRODUCTION", b: 9805388040, r: 12913723587, yb: 72991308570, yr: 93019988892 },
    { name: "BEBAN TYRE", b: 1902214328, r: 3986640738, yb: 14160083454, yr: 26522881861 },
    { name: "BEBAN SUB KONTRAKTOR", b: 11959183673, r: 13500000000, yb: 86000000000, yr: 81500000000 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 11575036579, r: 13100000000, yb: 83200000000, yr: 80000000000 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 1521771462, r: 1544814475, yb: 11328066763, yr: 11223622983 },
    { name: "BEBAN SPAREPART", b: 1141328597, r: 1392189248, yb: 8496050072, yr: 9201453734 },
    { name: "BEBAN TOOLS", b: 38044287, r: 9017033, yb: 283201669, yr: 241009606 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 482999330, r: 1100000000, yb: 3500000000, yr: 5200000000 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 160999776, r: 250000000, yb: 1200000000, yr: 1800000000 },
    { name: "BEBAN MOBILISASI", b: 64964823, r: 85000000, yb: 495000000, yr: 1180000000 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 245192922, r: 58211092, yb: 1339127665, yr: 3640930163 },
  ];

  for (let i = 0; i < senyiurWeek30Items.length; i++) {
    const it = senyiurWeek30Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: senyiurWeek30.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: senyiurWeek30.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // -6. SITE SENYIUR - WEEK 31 (01-06 Agst 2026) - Exactly from Week 31 Image 1
  // =========================================================================
  const senyiurWeek31 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "Senyiur",
        year: 2026,
        weekNumber: 31,
      },
    },
    update: {
      periodName: "01-06 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-06"),
      budgetProduksi: 143964,
      realisasiProduksi: 128020,
      ytdBudgetProduksi: 5526298,
      ytdRealisasiProduksi: 4893083,
      status: "Final",
    },
    create: {
      jobSite: "Senyiur",
      periodName: "01-06 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-06"),
      year: 2026,
      weekNumber: 31,
      budgetProduksi: 143964,
      realisasiProduksi: 128020,
      ytdBudgetProduksi: 5526298,
      ytdRealisasiProduksi: 4893083,
      status: "Final",
    },
  });

  const senyiurWeek31Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 435546764, r: 450000000, yb: 20258079950, yr: 37254724143 },
    { name: "BEBAN CONSUMABLES", b: 2358745766, r: 2544954211, yb: 90544387475, yr: 129005378126 },
    { name: "BEBAN FUEL - PRODUCTION", b: 1961077608, r: 1980179956, yb: 75279232446, yr: 96006960871 },
    { name: "BEBAN TYRE", b: 380442866, r: 433983698, yb: 14603933464, yr: 27179024740 },
    { name: "BEBAN SUB KONTRAKTOR", b: 2391836735, r: 2200000000, yb: 88580952381, yr: 85200000000 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 2315007316, r: 2150000000, yb: 85595798790, yr: 83500000000 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 304354292, r: 129399809, yb: 11114207147, yr: 11679431269 },
    { name: "BEBAN SPAREPART", b: 228265719, r: 57820044, yb: 8762360078, yr: 9455041334 },
    { name: "BEBAN TOOLS", b: 7608857, r: 10450820, yb: 292078669, yr: 312912276 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 96599866, r: 270000000, yb: 3716530902, yr: 5866083705 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 32200000, r: 50000000, yb: 1252222937, yr: 1917914342 },
    { name: "BEBAN MOBILISASI", b: 12992964, r: 25000000, yb: 510113250, yr: 1223177481 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 49038585, r: 36791081, yb: 1552135247, yr: 3832176799 },
  ];

  for (let i = 0; i < senyiurWeek31Items.length; i++) {
    const it = senyiurWeek31Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: senyiurWeek31.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: senyiurWeek31.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // -5. SITE SENYIUR - WEEK 32 (01-14 Agst 2026) - Exactly from Week 32 Image 1
  // =========================================================================
  const senyiurWeek32 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "Senyiur",
        year: 2026,
        weekNumber: 32,
      },
    },
    update: {
      periodName: "01-14 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-14"),
      budgetProduksi: 335916,
      realisasiProduksi: 290073,
      ytdBudgetProduksi: 5718250,
      ytdRealisasiProduksi: 5055136,
      status: "Final",
    },
    create: {
      jobSite: "Senyiur",
      periodName: "01-14 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-14"),
      year: 2026,
      weekNumber: 32,
      budgetProduksi: 335916,
      realisasiProduksi: 290073,
      ytdBudgetProduksi: 5718250,
      ytdRealisasiProduksi: 5055136,
      status: "Final",
    },
  });

  const senyiurWeek32Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 1016275783, r: 1100000000, yb: 20758079950, yr: 37904724143 },
    { name: "BEBAN CONSUMABLES", b: 5503740121, r: 7182492030, yb: 93689381829, yr: 133642915945 },
    { name: "BEBAN FUEL - PRODUCTION", b: 4575847752, r: 5621381428, yb: 77894002590, yr: 99648162343 },
    { name: "BEBAN TYRE", b: 887700020, r: 1364341962, yb: 15111190618, yr: 28109383004 },
    { name: "BEBAN SUB KONTRAKTOR", b: 5580952381, r: 4850000000, yb: 91580952381, yr: 87850000000 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 5401683737, r: 4700000000, yb: 88595798790, yr: 86000000000 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 710160016, r: 588471779, yb: 11520012870, yr: 12138503240 },
    { name: "BEBAN SPAREPART", b: 532620012, r: 449866664, yb: 9066714371, yr: 9847087954 },
    { name: "BEBAN TOOLS", b: 17754000, r: 20993870, yb: 302223812, yr: 323455326 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 225399687, r: 520000000, yb: 3816530902, yr: 6116083705 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 75133229, r: 100000000, yb: 1282222937, yr: 1967914342 },
    { name: "BEBAN MOBILISASI", b: 30316917, r: 42000000, yb: 520113250, yr: 1240177481 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 114423364, r: 40220947, yb: 1923488467, yr: 3835606664 },
  ];

  for (let i = 0; i < senyiurWeek32Items.length; i++) {
    const it = senyiurWeek32Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: senyiurWeek32.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: senyiurWeek32.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // -4. SITE SENYIUR - WEEK 33 (01-21 Agst 2026) - Exactly from Week 33 Image 1
  // =========================================================================
  const senyiurWeek33 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "Senyiur",
        year: 2026,
        weekNumber: 33,
      },
    },
    update: {
      periodName: "01-21 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-21"),
      budgetProduksi: 503874,
      realisasiProduksi: 329844,
      ytdBudgetProduksi: 5886208,
      ytdRealisasiProduksi: 5094907,
      status: "Final",
    },
    create: {
      jobSite: "Senyiur",
      periodName: "01-21 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-21"),
      year: 2026,
      weekNumber: 33,
      budgetProduksi: 503874,
      realisasiProduksi: 329844,
      ytdBudgetProduksi: 5886208,
      ytdRealisasiProduksi: 5094907,
      status: "Final",
    },
  });

  const senyiurWeek33Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 1524413675, r: 1650000000, yb: 21266217842, yr: 38454724143 },
    { name: "BEBAN CONSUMABLES", b: 8255610181, r: 9338345262, yb: 96441251890, yr: 135798769176 },
    { name: "BEBAN FUEL - PRODUCTION", b: 6863771628, r: 7004467718, yb: 80181926466, yr: 101031248633 },
    { name: "BEBAN TYRE", b: 1331550029, r: 1878610009, yb: 15555040627, yr: 28623651052 },
    { name: "BEBAN SUB KONTRAKTOR", b: 8371428571, r: 8500000000, yb: 94371428571, yr: 91500000000 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 8102525605, r: 8200000000, yb: 91297474395, yr: 89500000000 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 1065240023, r: 2214506655, yb: 11875092878, yr: 13764538115 },
    { name: "BEBAN SPAREPART", b: 798930018, r: 1359249023, yb: 9333024376, yr: 10756470313 },
    { name: "BEBAN TOOLS", b: 26631001, r: 29367770, yb: 311100813, yr: 331829226 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 338099531, r: 750000000, yb: 3929230746, yr: 6346083705 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 112699843, r: 150000000, yb: 1319789551, yr: 2017914342 },
    { name: "BEBAN MOBILISASI", b: 45475376, r: 60000000, yb: 535271352, yr: 1258177481 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 171635046, r: 59802824, yb: 380700504, yr: 3855188544 },
  ];

  for (let i = 0; i < senyiurWeek33Items.length; i++) {
    const it = senyiurWeek33Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: senyiurWeek33.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: senyiurWeek33.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // -3. SITE SENYIUR - WEEK 34 (01-28 Agst 2026) - Exactly from Week 34 Image 1
  // =========================================================================
  const senyiurWeek34 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "Senyiur",
        year: 2026,
        weekNumber: 34,
      },
    },
    update: {
      periodName: "01-28 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-28"),
      budgetProduksi: 671832,
      realisasiProduksi: 329844,
      ytdBudgetProduksi: 6054166,
      ytdRealisasiProduksi: 5094907,
      status: "Final",
    },
    create: {
      jobSite: "Senyiur",
      periodName: "01-28 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-28"),
      year: 2026,
      weekNumber: 34,
      budgetProduksi: 671832,
      realisasiProduksi: 329844,
      ytdBudgetProduksi: 6054166,
      ytdRealisasiProduksi: 5094907,
      status: "Final",
    },
  });

  const senyiurWeek34Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 2032551567, r: 2100000000, yb: 21774355734, yr: 38904724143 },
    { name: "BEBAN CONSUMABLES", b: 11007480242, r: 9860317745, yb: 99193121950, yr: 136320741659 },
    { name: "BEBAN FUEL - PRODUCTION", b: 9151695504, r: 7521189344, yb: 82469850342, yr: 101547970259 },
    { name: "BEBAN TYRE", b: 1775400039, r: 1855326580, yb: 15998890637, yr: 28600367622 },
    { name: "BEBAN SUB KONTRAKTOR", b: 11161904762, r: 11000000000, yb: 97161428572, yr: 94000000000 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 10803367473, r: 10600000000, yb: 94000000000, yr: 92000000000 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 1420320031, r: 2562220270, yb: 12230172886, yr: 14112251731 },
    { name: "BEBAN SPAREPART", b: 1065240023, r: 1659885083, yb: 9599334382, yr: 11057106372 },
    { name: "BEBAN TOOLS", b: 35508001, r: 44653770, yb: 319977813, yr: 347115226 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 450799375, r: 855337521, yb: 4041930590, yr: 6451421226 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 150266458, r: 200000000, yb: 1357356009, yr: 2067914342 },
    { name: "BEBAN MOBILISASI", b: 60633834, r: 65000000, yb: 550429810, yr: 1263177481 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 228846726, r: 24217764, yb: 388538690, yr: 2248975399 },
  ];

  for (let i = 0; i < senyiurWeek34Items.length; i++) {
    const it = senyiurWeek34Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: senyiurWeek34.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: senyiurWeek34.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // -2. SITE SENYIUR - WEEK 35 (01-03 Sept 2026) - Exactly from Week 35 Image 2
  // =========================================================================
  const senyiurWeek35 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "Senyiur",
        year: 2026,
        weekNumber: 35,
      },
    },
    update: {
      periodName: "01-03 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-03"),
      budgetProduksi: 71982,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 6198130,
      ytdRealisasiProduksi: 5169466,
      status: "Final",
    },
    create: {
      jobSite: "Senyiur",
      periodName: "01-03 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-03"),
      year: 2026,
      weekNumber: 35,
      budgetProduksi: 71982,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 6198130,
      ytdRealisasiProduksi: 5169466,
      status: "Final",
    },
  });

  const senyiurWeek35Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 214697890, r: 281889961, yb: 21989053624, yr: 39186614104 },
    { name: "BEBAN CONSUMABLES", b: 1179372883, r: 63540259, yb: 101551867716, yr: 138994293219 },
    { name: "BEBAN FUEL - PRODUCTION", b: 102985, r: 62772727, yb: 8867728, yr: 113802987 },
    { name: "BEBAN TYRE", b: 190221433, r: 0, yb: 16379333503, yr: 28975133688 },
    { name: "BEBAN SUB KONTRAKTOR", b: 1178571429, r: 135932000, yb: 101482857143, yr: 97304297401 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 1140740741, r: 0, yb: 98225382716, yr: 96369906821 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 152177146, r: 18005170, yb: 12455902319, yr: 14403017397 },
    { name: "BEBAN SPAREPART", b: 114132860, r: 2014170, yb: 9827600102, yr: 11103057597 },
    { name: "BEBAN TOOLS", b: 3804429, r: 0, yb: 327586670, yr: 366045826 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 47555358, r: 55543974, yb: 4089485948, yr: 6506965200 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 15948880, r: 0, yb: 1373304889, yr: 2067914342 },
    { name: "BEBAN MOBILISASI", b: 6467529, r: 27282050, yb: 556897339, yr: 1290459531 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 4565314, r: 4565314, yb: 393104004, yr: 2253540713 },
  ];

  for (let i = 0; i < senyiurWeek35Items.length; i++) {
    const it = senyiurWeek35Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: senyiurWeek35.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: senyiurWeek35.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // -1. SITE SENYIUR - WEEK 36 (01-11 Sept 2026) - Exactly from Week 36 Image 2
  // =========================================================================
  const senyiurWeek36 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "Senyiur",
        year: 2026,
        weekNumber: 36,
      },
    },
    update: {
      periodName: "01-11 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-11"),
      budgetProduksi: 263934,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 6390082,
      ytdRealisasiProduksi: 5169466,
      status: "Final",
    },
    create: {
      jobSite: "Senyiur",
      periodName: "01-11 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-11"),
      year: 2026,
      weekNumber: 36,
      budgetProduksi: 263934,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 6390082,
      ytdRealisasiProduksi: 5169466,
      status: "Final",
    },
  });

  const senyiurWeek36Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 787225596, r: 769111184, yb: 22561581330, yr: 39673835327 },
    { name: "BEBAN CONSUMABLES", b: 4324367238, r: 121990193, yb: 104696862071, yr: 139052743153 },
    { name: "BEBAN FUEL - PRODUCTION", b: 377613, r: 121222662, yb: 9142356, yr: 0 },
    { name: "BEBAN TYRE", b: 697478587, r: 0, yb: 16886590657, yr: 28975133688 },
    { name: "BEBAN SUB KONTRAKTOR", b: 4321428571, r: 3399209902, yb: 104625714286, yr: 100567575303 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 4182716049, r: 3194074074, yb: 101267358025, yr: 99563980895 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 557982869, r: 20763670, yb: 12861708043, yr: 14405775897 },
    { name: "BEBAN SPAREPART", b: 418487152, r: 2014170, yb: 10131954394, yr: 11103057597 },
    { name: "BEBAN TOOLS", b: 13949572, r: 1090000, yb: 337731813, yr: 367135826 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 174369647, r: 61987613, yb: 4216300236, yr: 6513408839 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 58479226, r: 0, yb: 1415835236, yr: 2067914342 },
    { name: "BEBAN MOBILISASI", b: 23714272, r: 35897435, yb: 574144082, yr: 1299074916 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 16739486, r: 16739486, yb: 405278176, yr: 2265714885 },
  ];

  for (let i = 0; i < senyiurWeek36Items.length; i++) {
    const it = senyiurWeek36Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: senyiurWeek36.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: senyiurWeek36.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 0. SITE SENYIUR - WEEK 37 (01-18 Sept 2026) - Exactly from Week 37 Image 1
  // =========================================================================
  const senyiurWeek37 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "Senyiur",
        year: 2026,
        weekNumber: 37,
      },
    },
    update: {
      periodName: "01-18 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-18"),
      budgetProduksi: 431892,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 6558040,
      ytdRealisasiProduksi: 5169466,
      status: "Final",
    },
    create: {
      jobSite: "Senyiur",
      periodName: "01-18 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-18"),
      year: 2026,
      weekNumber: 37,
      budgetProduksi: 431892,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 6558040,
      ytdRealisasiProduksi: 5169466,
      status: "Final",
    },
  });

  const senyiurWeek37Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 1288187340, r: 2068362066, yb: 23062543074, yr: 40973086209 },
    { name: "BEBAN CONSUMABLES", b: 7076237298, r: 508611637, yb: 107448732132, yr: 139439364598 },
    { name: "BEBAN FUEL - PRODUCTION", b: 617912, r: 488741883, yb: 9382655, yr: 0 },
    { name: "BEBAN TYRE", b: 1141328597, r: 0, yb: 17330440666, yr: 28975133688 },
    { name: "BEBAN SUB KONTRAKTOR", b: 6167961904, r: 5740263605, yb: 106472247619, yr: 102908629007 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 5940977777, r: 5482977777, yb: 103025619753, yr: 101852884598 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 913062877, r: 56184891, yb: 13216788050, yr: 14441197118 },
    { name: "BEBAN SPAREPART", b: 684797158, r: 2586318, yb: 10398264400, yr: 11103629744 },
    { name: "BEBAN TOOLS", b: 22826572, r: 1680000, yb: 346608813, yr: 367725826 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 285332149, r: 416871439, yb: 4327262739, yr: 6893042665 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 95693280, r: 95693280, yb: 1453049289, yr: 2163607622 },
    { name: "BEBAN MOBILISASI", b: 38805172, r: 35897435, yb: 589234983, yr: 1299074916 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 27391886, r: 27391886, yb: 415930576, yr: 2276367285 },
  ];

  for (let i = 0; i < senyiurWeek37Items.length; i++) {
    const it = senyiurWeek37Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: senyiurWeek37.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: senyiurWeek37.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 1. SITE SENYIUR - WEEK 38 (01-25 Sept 2026) - Exactly from new Image 1
  // =========================================================================
  const senyiurWeek38 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "Senyiur",
        year: 2026,
        weekNumber: 38,
      },
    },
    update: {
      periodName: "01-25 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-25"),
      budgetProduksi: 331670,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 6725998,
      ytdRealisasiProduksi: 5169466,
      status: "Final",
    },
    create: {
      jobSite: "Senyiur",
      periodName: "01-25 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-25"),
      year: 2026,
      weekNumber: 38,
      budgetProduksi: 331670,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 6725998,
      ytdRealisasiProduksi: 5169466,
      status: "Final",
    },
  });

  const senyiurWeek38Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 1160796271, r: 1982782967, yb: 22679304178, yr: 40887507109 },
    { name: "BEBAN CONSUMABLES", b: 7922217811, r: 523848139, yb: 107115339761, yr: 139454601099 },
    { name: "BEBAN FUEL - PRODUCTION", b: 6805222900, r: 521903726, yb: 89275073242, yr: 104162190714 },
    { name: "BEBAN TYRE", b: 876470625, r: 0, yb: 16875361262, yr: 28975133688 },
    { name: "BEBAN SUB KONTRAKTOR", b: 6361809940, r: 6444785828, yb: 105487524226, yr: 105300651229 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 6187500000, r: 6187500000, yb: 102131401235, yr: 104244906821 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 701176500, r: 59659891, yb: 12931349386, yr: 14444672118 },
    { name: "BEBAN SPAREPART", b: 525882375, r: 2586318, yb: 10125216757, yr: 11103629744 },
    { name: "BEBAN TOOLS", b: 17529413, r: 5155000, yb: 337507225, yr: 371200826 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 398305923, r: 563035492, yb: 4392681154, yr: 7137026071 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 232083333, r: 232083333, yb: 1573490463, yr: 2397817028 },
    { name: "BEBAN MOBILISASI", b: 29800001, r: 35897435, yb: 573762283, yr: 1299074916 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 21035295, r: 21035295, yb: 405008670, yr: 2270010694 },
  ];

  for (let i = 0; i < senyiurWeek38Items.length; i++) {
    const it = senyiurWeek38Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: senyiurWeek38.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: senyiurWeek38.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 2. SITE SENYIUR - WEEK 39 (01-30 Sept 2026)
  // =========================================================================
  const senyiurWeek39 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "Senyiur",
        year: 2026,
        weekNumber: 39,
      },
    },
    update: {
      periodName: "01-30 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-30"),
      budgetProduksi: 398000,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 6524148,
      ytdRealisasiProduksi: 5261607,
      status: "Final",
    },
    create: {
      jobSite: "Senyiur",
      periodName: "01-30 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-30"),
      year: 2026,
      weekNumber: 39,
      budgetProduksi: 398000,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 6524148,
      ytdRealisasiProduksi: 5261607,
      status: "Final",
    },
  });

  const senyiurWeek39Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 2591849237, r: 2903078297, yb: 24626204971, yr: 40950752156 },
    { name: "BEBAN CONSUMABLES", b: 9506661373, r: 556424937, yb: 109879156206, yr: 140894004624 },
    { name: "BEBAN FUEL - PRODUCTION", b: 8166267480, r: 553610655, yb: 91616656626, yr: 105294237737 },
    { name: "BEBAN TYRE", b: 1051764750, r: 0, yb: 17240876820, yr: 29071049049 },
    { name: "BEBAN SUB KONTRAKTOR", b: 7601171928, r: 7649285828, yb: 107905457643, yr: 104817651229 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 7392000000, r: 7392000000, yb: 104476641975, yr: 103761906821 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 841411800, r: 64318233, yb: 13145136973, yr: 14129197291 },
    { name: "BEBAN SPAREPART", b: 631058850, r: 4750660, yb: 10344526092, yr: 11236253830 },
    { name: "BEBAN TOOLS", b: 21035295, r: 6905000, yb: 344817536, yr: 377486159 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 424520786, r: 898517845, yb: 4466451376, yr: 7526768062 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 278500000, r: 567902686, yb: 1635856009, yr: 2635817028 },
    { name: "BEBAN MOBILISASI", b: 35760002, r: 35897435, yb: 586189812, yr: 1302004194 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 25242354, r: 25242354, yb: 413781044, yr: 2274217753 },
  ];

  for (let i = 0; i < senyiurWeek39Items.length; i++) {
    const it = senyiurWeek39Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: senyiurWeek39.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: senyiurWeek39.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 3. SITE SENYIUR - WEEK 40 (01-08 Okt 2026)
  // =========================================================================
  const senyiurWeek40 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "Senyiur",
        year: 2026,
        weekNumber: 40,
      },
    },
    update: {
      periodName: "01-08 Okt 2026",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-08"),
      budgetProduksi: 173161,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 6697309,
      ytdRealisasiProduksi: 5186909,
      status: "Active",
    },
    create: {
      jobSite: "Senyiur",
      periodName: "01-08 Okt 2026",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-08"),
      year: 2026,
      weekNumber: 40,
      budgetProduksi: 173161,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 6697309,
      ytdRealisasiProduksi: 5186909,
      status: "Active",
    },
  });

  const senyiurWeek40Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 416492654, r: 787988434, yb: 24786849797, yr: 41470013956 },
    { name: "BEBAN CONSUMABLES", b: 58608723, r: 34237074, yb: 108758392046, yr: 137186218017 },
    { name: "BEBAN FUEL - PRODUCTION", b: 58001301, r: 33623049, yb: 90694119122, yr: 102310815333 },
    { name: "BEBAN TYRE", b: 0, r: 0, yb: 17050655387, yr: 28699367622 },
    { name: "BEBAN SUB KONTRAKTOR", b: 863270175, r: 809290323, yb: 107590156389, yr: 104486200811 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 809290323, r: 809290323, yb: 104145191557, yr: 103430456403 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 2754863, r: 1206113, yb: 13074339548, yr: 13683655378 },
    { name: "BEBAN SPAREPART", b: 1639440, r: 419026, yb: 10232032672, yr: 11046357448 },
    { name: "BEBAN TOOLS", b: 0, r: 0, yb: 341013107, yr: 353875226 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 86726334, r: 147214871, yb: 4505622351, yr: 7364822235 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 43483871, r: 43483871, yb: 1663390999, yr: 2656300899 },
    { name: "BEBAN MOBILISASI", b: 2645161, r: 0, yb: 582367444, yr: 1274522326 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 6514156, r: 6514156, yb: 415729884, yr: 2276166594 },
  ];

  for (let i = 0; i < senyiurWeek40Items.length; i++) {
    const it = senyiurWeek40Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: senyiurWeek40.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: senyiurWeek40.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 3a000000-prev. SITE MUARA PAHU - WEEK 29 (01-23 Jul 2026) - Exactly from Week 29 Image 2
  // =========================================================================
  const muaraPahuWeek29 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "MuaraPahu",
        year: 2026,
        weekNumber: 29,
      },
    },
    update: {
      periodName: "01-23 Jul 2026",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-23"),
      budgetProduksi: 0,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 0,
      ytdRealisasiProduksi: 0,
      status: "Final",
    },
    create: {
      jobSite: "MuaraPahu",
      periodName: "01-23 Jul 2026",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-23"),
      year: 2026,
      weekNumber: 29,
      budgetProduksi: 0,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 0,
      ytdRealisasiProduksi: 0,
      status: "Final",
    },
  });

  const muaraPahuWeek29Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 271215253, r: 107202500, yb: 271215253, yr: 132515500 },
    { name: "BEBAN CONSUMABLES", b: 1685220989, r: 296919588, yb: 1685220989, yr: 296919588 },
    { name: "BEBAN FUEL - PRODUCTION", b: 1457622197, r: 296682738, yb: 1457622197, yr: 296682738 },
    { name: "BEBAN TYRE", b: 210652624, r: 0, yb: 210652624, yr: 0 },
    { name: "BEBAN SUB KONTRAKTOR", b: 0, r: 0, yb: 0, yr: 0 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 0, r: 0, yb: 0, yr: 0 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 210652624, r: 98235605, yb: 210652624, yr: 179990331 },
    { name: "BEBAN SPAREPART", b: 63195787, r: 0, yb: 63195787, yr: 25364579 },
    { name: "BEBAN TOOLS", b: 5266316, r: 55185850, yb: 5266316, yr: 87768764 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 156990462, r: 209518300, yb: 156990462, yr: 543261075 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 0, r: 23920000, yb: 0, yr: 92280000 },
    { name: "BEBAN MOBILISASI", b: 21366012, r: 300763500, yb: 21366012, yr: 712238500 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 836951501, r: 0, yb: 836951501, yr: 0 },
  ];

  for (let i = 0; i < muaraPahuWeek29Items.length; i++) {
    const it = muaraPahuWeek29Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: muaraPahuWeek29.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: muaraPahuWeek29.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 3a000000. SITE MUARA PAHU - WEEK 30 (01-30 Jul 2026) - Exactly from Week 30 Image 2
  // =========================================================================
  const muaraPahuWeek30 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "MuaraPahu",
        year: 2026,
        weekNumber: 30,
      },
    },
    update: {
      periodName: "01-30 Jul 2026",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-30"),
      budgetProduksi: 0,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 0,
      ytdRealisasiProduksi: 0,
      status: "Final",
    },
    create: {
      jobSite: "MuaraPahu",
      periodName: "01-30 Jul 2026",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-30"),
      year: 2026,
      weekNumber: 30,
      budgetProduksi: 0,
      realisasiProduksi: 0,
      ytdBudgetProduksi: 0,
      ytdRealisasiProduksi: 0,
      status: "Final",
    },
  });

  const muaraPahuWeek30Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 353759026, r: 501018320, yb: 353759026, yr: 526331320 },
    { name: "BEBAN CONSUMABLES", b: 2198114334, r: 296919588, yb: 2198114334, yr: 296919588 },
    { name: "BEBAN FUEL - PRODUCTION", b: 1901246344, r: 296682738, yb: 1901246344, yr: 296682738 },
    { name: "BEBAN TYRE", b: 274764292, r: 0, yb: 274764292, yr: 0 },
    { name: "BEBAN SUB KONTRAKTOR", b: 0, r: 0, yb: 0, yr: 0 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 0, r: 0, yb: 0, yr: 0 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 274764292, r: 116502111, yb: 274764292, yr: 198256837 },
    { name: "BEBAN SPAREPART", b: 82429288, r: 0, yb: 82429288, yr: 25364579 },
    { name: "BEBAN TOOLS", b: 6869107, r: 60923850, yb: 6869107, yr: 93506764 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 204770168, r: 250340240, yb: 204770168, yr: 584083015 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 0, r: 46920000, yb: 0, yr: 115280000 },
    { name: "BEBAN MOBILISASI", b: 27868712, r: 431403623, yb: 27868712, yr: 842878623 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 1091675870, r: 0, yb: 1091675870, yr: 6337369 },
  ];

  for (let i = 0; i < muaraPahuWeek30Items.length; i++) {
    const it = muaraPahuWeek30Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: muaraPahuWeek30.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: muaraPahuWeek30.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 3a00000. SITE MUARA PAHU - WEEK 31 (01-06 Agst 2026) - Exactly from Week 31 Image 2
  // =========================================================================
  const muaraPahuWeek31 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "MuaraPahu",
        year: 2026,
        weekNumber: 31,
      },
    },
    update: {
      periodName: "01-06 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-06"),
      budgetProduksi: 18866,
      realisasiProduksi: 17204,
      ytdBudgetProduksi: 18866,
      ytdRealisasiProduksi: 17204,
      status: "Final",
    },
    create: {
      jobSite: "MuaraPahu",
      periodName: "01-06 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-06"),
      year: 2026,
      weekNumber: 31,
      budgetProduksi: 18866,
      realisasiProduksi: 17204,
      ytdBudgetProduksi: 18866,
      ytdRealisasiProduksi: 17204,
      status: "Final",
    },
  });

  const muaraPahuWeek31Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 70751805, r: 800000, yb: 424510831, yr: 527131320 },
    { name: "BEBAN CONSUMABLES", b: 439622867, r: 576090346, yb: 2637737201, yr: 873009934 },
    { name: "BEBAN FUEL - PRODUCTION", b: 380249269, r: 535098559, yb: 2281495613, yr: 831781298 },
    { name: "BEBAN TYRE", b: 54952858, r: 40991787, yb: 329717150, yr: 40991787 },
    { name: "BEBAN SUB KONTRAKTOR", b: 0, r: 0, yb: 0, yr: 0 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 0, r: 0, yb: 0, yr: 0 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 54952858, r: 2037669, yb: 329717150, yr: 200294506 },
    { name: "BEBAN SPAREPART", b: 16485858, r: 495000, yb: 98915145, yr: 25859579 },
    { name: "BEBAN TOOLS", b: 1373821, r: 0, yb: 8242929, yr: 93506764 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 40954034, r: 4792000, yb: 245724202, yr: 588875015 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 0, r: 0, yb: 0, yr: 115280000 },
    { name: "BEBAN MOBILISASI", b: 5573742, r: 0, yb: 33442454, yr: 842878623 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 218335174, r: 0, yb: 1310011044, yr: 6337369 },
  ];

  for (let i = 0; i < muaraPahuWeek31Items.length; i++) {
    const it = muaraPahuWeek31Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: muaraPahuWeek31.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: muaraPahuWeek31.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 3a0000. SITE MUARA PAHU - WEEK 32 (01-14 Agst 2026) - Exactly from Week 32 Image 2
  // =========================================================================
  const muaraPahuWeek32 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "MuaraPahu",
        year: 2026,
        weekNumber: 32,
      },
    },
    update: {
      periodName: "01-14 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-14"),
      budgetProduksi: 44021,
      realisasiProduksi: 45969,
      ytdBudgetProduksi: 44021,
      ytdRealisasiProduksi: 45969,
      status: "Final",
    },
    create: {
      jobSite: "MuaraPahu",
      periodName: "01-14 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-14"),
      year: 2026,
      weekNumber: 32,
      budgetProduksi: 44021,
      realisasiProduksi: 45969,
      ytdBudgetProduksi: 44021,
      ytdRealisasiProduksi: 45969,
      status: "Final",
    },
  });

  const muaraPahuWeek32Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 165087545, r: 250446545, yb: 518846571, yr: 776777865 },
    { name: "BEBAN CONSUMABLES", b: 1025786689, r: 998333430, yb: 3223901023, yr: 1295253018 },
    { name: "BEBAN FUEL - PRODUCTION", b: 887248294, r: 810548005, yb: 2788494638, yr: 1107230743 },
    { name: "BEBAN TYRE", b: 128223336, r: 117867380, yb: 402987628, yr: 117867380 },
    { name: "BEBAN SUB KONTRAKTOR", b: 0, r: 0, yb: 0, yr: 0 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 0, r: 0, yb: 0, yr: 0 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 128223336, r: 176906758, yb: 402987628, yr: 375163595 },
    { name: "BEBAN SPAREPART", b: 38467001, r: 495000, yb: 120896288, yr: 25859579 },
    { name: "BEBAN TOOLS", b: 3205583, r: 13197500, yb: 10074691, yr: 106704264 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 95559412, r: 91283540, yb: 300329580, yr: 675366555 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 0, r: 23000000, yb: 0, yr: 138280000 },
    { name: "BEBAN MOBILISASI", b: 13005399, r: 12244898, yb: 40874111, yr: 855123521 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 509448740, r: 0, yb: 1601124610, yr: 6337369 },
  ];

  for (let i = 0; i < muaraPahuWeek32Items.length; i++) {
    const it = muaraPahuWeek32Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: muaraPahuWeek32.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: muaraPahuWeek32.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 3a000. SITE MUARA PAHU - WEEK 33 (01-21 Agst 2026) - Exactly from Week 33 Image 2
  // =========================================================================
  const muaraPahuWeek33 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "MuaraPahu",
        year: 2026,
        weekNumber: 33,
      },
    },
    update: {
      periodName: "01-21 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-21"),
      budgetProduksi: 66032,
      realisasiProduksi: 57519,
      ytdBudgetProduksi: 66032,
      ytdRealisasiProduksi: 57519,
      status: "Final",
    },
    create: {
      jobSite: "MuaraPahu",
      periodName: "01-21 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-21"),
      year: 2026,
      weekNumber: 33,
      budgetProduksi: 66032,
      realisasiProduksi: 57519,
      ytdBudgetProduksi: 66032,
      ytdRealisasiProduksi: 57519,
      status: "Final",
    },
  });

  const muaraPahuWeek33Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 247631318, r: 333740318, yb: 601390344, yr: 860071638 },
    { name: "BEBAN CONSUMABLES", b: 1538680034, r: 2316195788, yb: 3736794368, yr: 2613115377 },
    { name: "BEBAN FUEL - PRODUCTION", b: 1330872441, r: 2000751385, yb: 3232118784, yr: 2297434123 },
    { name: "BEBAN TYRE", b: 192335004, r: 192932587, yb: 467099296, yr: 192932587 },
    { name: "BEBAN SUB KONTRAKTOR", b: 0, r: 0, yb: 0, yr: 0 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 0, r: 0, yb: 0, yr: 0 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 192335004, r: 285821592, yb: 467099296, yr: 484078430 },
    { name: "BEBAN SPAREPART", b: 57700501, r: 68212513, yb: 140129789, yr: 93577091 },
    { name: "BEBAN TOOLS", b: 4808375, r: 16903100, yb: 11677482, yr: 110409864 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 143339118, r: 164119861, yb: 348109286, yr: 748202876 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 0, r: 23000000, yb: 0, yr: 138280000 },
    { name: "BEBAN MOBILISASI", b: 19508098, r: 24552590, yb: 47376810, yr: 867431213 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 764173109, r: 0, yb: 1855848979, yr: 6337369 },
  ];

  for (let i = 0; i < muaraPahuWeek33Items.length; i++) {
    const it = muaraPahuWeek33Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: muaraPahuWeek33.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: muaraPahuWeek33.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 3a00. SITE MUARA PAHU - WEEK 34 (01-28 Agst 2026) - Exactly from Week 34 Image 2
  // =========================================================================
  const muaraPahuWeek34 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "MuaraPahu",
        year: 2026,
        weekNumber: 34,
      },
    },
    update: {
      periodName: "01-28 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-28"),
      budgetProduksi: 88043,
      realisasiProduksi: 57519,
      ytdBudgetProduksi: 88043,
      ytdRealisasiProduksi: 57519,
      status: "Final",
    },
    create: {
      jobSite: "MuaraPahu",
      periodName: "01-28 Agst 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-28"),
      year: 2026,
      weekNumber: 34,
      budgetProduksi: 88043,
      realisasiProduksi: 57519,
      ytdBudgetProduksi: 88043,
      ytdRealisasiProduksi: 57519,
      status: "Final",
    },
  });

  const muaraPahuWeek34Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 330175091, r: 422216803, yb: 683934116, yr: 948548123 },
    { name: "BEBAN CONSUMABLES", b: 2051573378, r: 2610011301, yb: 4249687712, yr: 2906930889 },
    { name: "BEBAN FUEL - PRODUCTION", b: 1774496588, r: 2092316730, yb: 3675742931, yr: 2388999468 },
    { name: "BEBAN TYRE", b: 256446672, r: 374766066, yb: 531210964, yr: 374766066 },
    { name: "BEBAN SUB KONTRAKTOR", b: 0, r: 0, yb: 0, yr: 0 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 0, r: 0, yb: 0, yr: 0 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 256446672, r: 272760497, yb: 531210964, yr: 471017334 },
    { name: "BEBAN SPAREPART", b: 76934002, r: 43937054, yb: 159363289, yr: 69301633 },
    { name: "BEBAN TOOLS", b: 6411167, r: 18930600, yb: 13280274, yr: 112437364 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 191020156, r: 180000000, yb: 395888991, yr: 762756555 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 0, r: 0, yb: 0, yr: 138280000 },
    { name: "BEBAN MOBILISASI", b: 26086305, r: 23226129, yb: 53880093, yr: 867431212 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 1018920640, r: 0, yb: 2110572768, yr: 6337369 },
  ];

  for (let i = 0; i < muaraPahuWeek34Items.length; i++) {
    const it = muaraPahuWeek34Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: muaraPahuWeek34.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: muaraPahuWeek34.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 3a0. SITE MUARA PAHU - WEEK 35 (01-03 Sept 2026) - Exactly from Week 35 Image 1
  // =========================================================================
  const muaraPahuWeek35 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "MuaraPahu",
        year: 2026,
        weekNumber: 35,
      },
    },
    update: {
      periodName: "01-03 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-03"),
      budgetProduksi: 9433,
      realisasiProduksi: 19463,
      ytdBudgetProduksi: 97476,
      ytdRealisasiProduksi: 76981,
      status: "Final",
    },
    create: {
      jobSite: "MuaraPahu",
      periodName: "01-03 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-03"),
      year: 2026,
      weekNumber: 35,
      budgetProduksi: 9433,
      realisasiProduksi: 19463,
      ytdBudgetProduksi: 97476,
      ytdRealisasiProduksi: 76981,
      status: "Final",
    },
  });

  const muaraPahuWeek35Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 35375903, r: 301634803, yb: 719310019, yr: 1250182925 },
    { name: "BEBAN CONSUMABLES", b: 219811433, r: 494166191, yb: 4469499146, yr: 3401097080 },
    { name: "BEBAN FUEL - PRODUCTION", b: 190124634, r: 494166191, yb: 3865867566, yr: 2883165659 },
    { name: "BEBAN TYRE", b: 27476429, r: 0, yb: 558687393, yr: 374766066 },
    { name: "BEBAN SUB KONTRAKTOR", b: 0, r: 851892500, yb: 0, yr: 851892500 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 0, r: 851892500, yb: 0, yr: 851892500 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 27476429, r: 147523873, yb: 558687393, yr: 618541207 },
    { name: "BEBAN SPAREPART", b: 8242929, r: 1189747, yb: 167606218, yr: 70491380 },
    { name: "BEBAN TOOLS", b: 686911, r: 0, yb: 13967185, yr: 112437364 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 20477017, r: 635660000, yb: 416366009, yr: 1398416555 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 0, r: 474100000, yb: 0, yr: 612380000 },
    { name: "BEBAN MOBILISASI", b: 2786871, r: 158896153, yb: 56666381, yr: 1026327366 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 109167587, r: 0, yb: 2219740936, yr: 6337369 },
  ];

  for (let i = 0; i < muaraPahuWeek35Items.length; i++) {
    const it = muaraPahuWeek35Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: muaraPahuWeek35.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: muaraPahuWeek35.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 3a. SITE MUARA PAHU - WEEK 36 (01-11 Sept 2026) - Exactly from Week 36 Image 1
  // =========================================================================
  const muaraPahuWeek36 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "MuaraPahu",
        year: 2026,
        weekNumber: 36,
      },
    },
    update: {
      periodName: "01-11 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-11"),
      budgetProduksi: 34588,
      realisasiProduksi: 78188,
      ytdBudgetProduksi: 122631,
      ytdRealisasiProduksi: 135706,
      status: "Final",
    },
    create: {
      jobSite: "MuaraPahu",
      periodName: "01-11 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-11"),
      year: 2026,
      weekNumber: 36,
      budgetProduksi: 34588,
      realisasiProduksi: 78188,
      ytdBudgetProduksi: 122631,
      ytdRealisasiProduksi: 135706,
      status: "Final",
    },
  });

  const muaraPahuWeek36Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 129711643, r: 415310877, yb: 813645759, yr: 1363858999 },
    { name: "BEBAN CONSUMABLES", b: 805975256, r: 2618564157, yb: 5055662968, yr: 5525495046 },
    { name: "BEBAN FUEL - PRODUCTION", b: 697123659, r: 2401669048, yb: 4372866591, yr: 4790668517 },
    { name: "BEBAN TYRE", b: 100746907, r: 92288306, yb: 631957871, yr: 467054372 },
    { name: "BEBAN SUB KONTRAKTOR", b: 0, r: 988641975, yb: 0, yr: 988641975 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 0, r: 988641975, yb: 0, yr: 988641975 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 100746907, r: 160717765, yb: 631957871, yr: 631735099 },
    { name: "BEBAN SPAREPART", b: 30224072, r: 4206446, yb: 189587361, yr: 73508079 },
    { name: "BEBAN TOOLS", b: 2518673, r: 3723000, yb: 15798947, yr: 116160364 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 75082395, r: 173574500, yb: 470971387, yr: 936331055 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 0, r: 0, yb: 0, yr: 138280000 },
    { name: "BEBAN MOBILISASI", b: 10218528, r: 174896152, yb: 64098037, yr: 1042327365 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 400281152, r: 0, yb: 2510854502, yr: 6337369 },
  ];

  for (let i = 0; i < muaraPahuWeek36Items.length; i++) {
    const it = muaraPahuWeek36Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: muaraPahuWeek36.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: muaraPahuWeek36.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 3b. SITE MUARA PAHU - WEEK 37 (01-18 Sept 2026) - Exactly from Week 37 Image 2
  // =========================================================================
  const muaraPahuWeek37 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "MuaraPahu",
        year: 2026,
        weekNumber: 37,
      },
    },
    update: {
      periodName: "01-18 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-18"),
      budgetProduksi: 56599,
      realisasiProduksi: 78188,
      ytdBudgetProduksi: 144641,
      ytdRealisasiProduksi: 135706,
      status: "Final",
    },
    create: {
      jobSite: "MuaraPahu",
      periodName: "01-18 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-18"),
      year: 2026,
      weekNumber: 37,
      budgetProduksi: 56599,
      realisasiProduksi: 78188,
      ytdBudgetProduksi: 144641,
      ytdRealisasiProduksi: 135706,
      status: "Final",
    },
  });

  const muaraPahuWeek37Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 212255415, r: 975396498, yb: 896189532, yr: 1923944621 },
    { name: "BEBAN CONSUMABLES", b: 1318868600, r: 3004437593, yb: 5568556313, yr: 5911368482 },
    { name: "BEBAN FUEL - PRODUCTION", b: 1140747806, r: 2762873721, yb: 4816490738, yr: 5151873189 },
    { name: "BEBAN TYRE", b: 164858575, r: 102542563, yb: 696069539, yr: 477308628 },
    { name: "BEBAN SUB KONTRAKTOR", b: 0, r: 1838874074, yb: 0, yr: 1838874074 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 0, r: 1838874074, yb: 0, yr: 1838874074 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 164858575, r: 641962550, yb: 696069539, yr: 1112979884 },
    { name: "BEBAN SPAREPART", b: 49457573, r: 16818456, yb: 208820862, yr: 86120089 },
    { name: "BEBAN TOOLS", b: 4121464, r: 10797300, yb: 17401738, yr: 123234664 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 122862101, r: 209409500, yb: 518751093, yr: 972166055 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 0, r: 0, yb: 0, yr: 138280000 },
    { name: "BEBAN MOBILISASI", b: 16721227, r: 213146152, yb: 70600737, yr: 1080577365 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 655005522, r: 0, yb: 2765578871, yr: 6337369 },
  ];

  for (let i = 0; i < muaraPahuWeek37Items.length; i++) {
    const it = muaraPahuWeek37Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: muaraPahuWeek37.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: muaraPahuWeek37.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 4. SITE MUARA PAHU - WEEK 38 (01-25 Sept 2026) - Exactly from new Image 2
  // =========================================================================
  const muaraPahuWeek38 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "MuaraPahu",
        year: 2026,
        weekNumber: 38,
      },
    },
    update: {
      periodName: "01-25 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-25"),
      budgetProduksi: 331667,
      realisasiProduksi: 131651,
      ytdBudgetProduksi: 419709,
      ytdRealisasiProduksi: 189169,
      status: "Final",
    },
    create: {
      jobSite: "MuaraPahu",
      periodName: "01-25 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-25"),
      year: 2026,
      weekNumber: 38,
      budgetProduksi: 331667,
      realisasiProduksi: 131651,
      ytdBudgetProduksi: 419709,
      ytdRealisasiProduksi: 189169,
      status: "Final",
    },
  });

  const muaraPahuWeek38Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 1400000000, r: 2198728883, yb: 2083934116, yr: 3147277006 },
    { name: "BEBAN CONSUMABLES", b: 10756782483, r: 4823600407, yb: 15006470196, yr: 7730531296 },
    { name: "BEBAN FUEL - PRODUCTION", b: 9790717083, r: 4405125927, yb: 13466460015, yr: 6794125395 },
    { name: "BEBAN TYRE", b: 966065400, r: 222388631, yb: 1497276364, yr: 597154697 },
    { name: "BEBAN SUB KONTRAKTOR", b: 2437500000, r: 2437500000, yb: 2437500000, yr: 2437500000 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 2437500000, r: 2437500000, yb: 2437500000, yr: 2437500000 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 966065400, r: 624526365, yb: 1497276364, yr: 1095543699 },
    { name: "BEBAN SPAREPART", b: 289819620, r: 87623888, yb: 449182909, yr: 156925521 },
    { name: "BEBAN TOOLS", b: 24151635, r: 12477300, yb: 37431909, yr: 124914664 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 719967552, r: 187233500, yb: 1115856544, yr: 949990055 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 0, r: 0, yb: 0, yr: 138280000 },
    { name: "BEBAN MOBILISASI", b: 97985798, r: 213146152, yb: 151865308, yr: 1080577365 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 2415163500, r: 0, yb: 4525736849, yr: 6337369 },
  ];

  for (let i = 0; i < muaraPahuWeek38Items.length; i++) {
    const it = muaraPahuWeek38Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: muaraPahuWeek38.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: muaraPahuWeek38.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 5. SITE MUARA PAHU - WEEK 39 (01-30 Sept 2026)
  // =========================================================================
  const muaraPahuWeek39 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "MuaraPahu",
        year: 2026,
        weekNumber: 39,
      },
    },
    update: {
      periodName: "01-30 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-30"),
      budgetProduksi: 398000,
      realisasiProduksi: 216232,
      ytdBudgetProduksi: 486043,
      ytdRealisasiProduksi: 273751,
      status: "Final",
    },
    create: {
      jobSite: "MuaraPahu",
      periodName: "01-30 Sept 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-30"),
      year: 2026,
      weekNumber: 39,
      budgetProduksi: 398000,
      realisasiProduksi: 216232,
      ytdBudgetProduksi: 486043,
      ytdRealisasiProduksi: 273751,
      status: "Final",
    },
  });

  const muaraPahuWeek39Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 1680000000, r: 2511036183, yb: 2363934116, yr: 3459584306 },
    { name: "BEBAN CONSUMABLES", b: 12908138980, r: 7433718308, yb: 17157826692, yr: 10340649197 },
    { name: "BEBAN FUEL - PRODUCTION", b: 11748860500, r: 6624558587, yb: 15424603431, yr: 9013558055 },
    { name: "BEBAN TYRE", b: 1159278480, r: 504432269, yb: 1690489444, yr: 879198334 },
    { name: "BEBAN SUB KONTRAKTOR", b: 4704000000, r: 4704000000, yb: 4704000000, yr: 4704000000 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 4704000000, r: 4704000000, yb: 4704000000, yr: 4704000000 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 1159278480, r: 749146569, yb: 1690489444, yr: 1220163902 },
    { name: "BEBAN SPAREPART", b: 347783544, r: 97762212, yb: 507146833, yr: 167063845 },
    { name: "BEBAN TOOLS", b: 28981962, r: 19639400, yb: 42262236, yr: 132076764 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 863961063, r: 222347500, yb: 1259850055, yr: 985104055 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 0, r: 0, yb: 0, yr: 138280000 },
    { name: "BEBAN MOBILISASI", b: 117582957, r: 133396152, yb: 171462467, yr: 1000827365 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 1449098100, r: 0, yb: 3559671449, yr: 6337369 },
  ];

  for (let i = 0; i < muaraPahuWeek39Items.length; i++) {
    const it = muaraPahuWeek39Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: muaraPahuWeek39.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: muaraPahuWeek39.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  // =========================================================================
  // 6. SITE MUARA PAHU - WEEK 40 (01-08 Okt 2026)
  // =========================================================================
  const muaraPahuWeek40 = await prisma.weeklyReport.upsert({
    where: {
      jobSite_year_weekNumber: {
        jobSite: "MuaraPahu",
        year: 2026,
        weekNumber: 40,
      },
    },
    update: {
      periodName: "01-08 Okt 2026",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-08"),
      budgetProduksi: 173161,
      realisasiProduksi: 147212,
      ytdBudgetProduksi: 659204,
      ytdRealisasiProduksi: 420963,
      status: "Active",
    },
    create: {
      jobSite: "MuaraPahu",
      periodName: "01-08 Okt 2026",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-08"),
      year: 2026,
      weekNumber: 40,
      budgetProduksi: 173161,
      realisasiProduksi: 147212,
      ytdBudgetProduksi: 659204,
      ytdRealisasiProduksi: 420963,
      status: "Active",
    },
  });

  const muaraPahuWeek40Items = [
    { name: "BEBAN COMPENSATION AND BENEFIT - SITE", b: 696774194, r: 732666765, yb: 3060708310, yr: 4112270831 },
    { name: "BEBAN CONSUMABLES", b: 4035018240, r: 1772385912, yb: 21192844932, yr: 12113035109 },
    { name: "BEBAN FUEL - PRODUCTION", b: 4781892323, r: 1212407543, yb: 20206495754, yr: 10225965598 },
    { name: "BEBAN TYRE", b: 504377280, r: 371628203, yb: 2194866724, yr: 1250826538 },
    { name: "BEBAN SUB KONTRAKTOR", b: 2312258065, r: 2312258065, yb: 7016258065, yr: 7016258065 },
    { name: "BEBAN RENTAL ALAT PRODUKSI", b: 2312258065, r: 2312258065, yb: 7016258065, yr: 7016258065 },
    { name: "BEBAN REPAIRS & MAINTENANCE", b: 504377280, r: 105807048, yb: 2194866724, yr: 1325970951 },
    { name: "BEBAN SPAREPART", b: 151313184, r: 81613957, yb: 658460017, yr: 248677801 },
    { name: "BEBAN TOOLS", b: 12609432, r: 419800, yb: 54871668, yr: 132496564 },
    { name: "BEBAN OVERHEAD COST - SITE", b: 375890986, r: 25843488, yb: 1635741041, yr: 1091947543 },
    { name: "BEBAN RENTAL ALAT NON PRODUKSI", b: 0, r: 0, yb: 0, yr: 219280000 },
    { name: "BEBAN MOBILISASI", b: 51157831, r: 0, yb: 222620298, yr: 1000827365 },
    { name: "BEBAN PENYUSUTAN DAN AMORTISASI - SITE", b: 630471600, r: 0, yb: 4190143049, yr: 6337369 },
  ];

  for (let i = 0; i < muaraPahuWeek40Items.length; i++) {
    const it = muaraPahuWeek40Items[i];
    await prisma.weeklyReportItem.upsert({
      where: {
        reportId_accountName: {
          reportId: muaraPahuWeek40.id,
          accountName: it.name,
        },
      },
      update: {
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
        orderIndex: i + 1,
      },
      create: {
        reportId: muaraPahuWeek40.id,
        accountName: it.name,
        orderIndex: i + 1,
        budgetCost: it.b,
        realisasiCost: it.r,
        ytdBudgetCost: it.yb,
        ytdRealisasiCost: it.yr,
      },
    });
  }

  console.log("All 24 reports (W29, W30, W31, W32, W33, W34, W35, W36, W37, W38, W39, W40 for both sites) successfully seeded!");
}

main()
  .catch((e) => {
    console.error("Error seeding reports:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
