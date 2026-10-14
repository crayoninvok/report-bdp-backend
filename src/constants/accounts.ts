export interface AccountDefinition {
  accountCode: string | null;
  name: string;
  costBehavior: string | null;
  accountGroup: string | null;
  subCategory: string | null;
  isParent: boolean;
  parentName?: string | null;
}

export const ACCOUNT_DEFINITIONS: AccountDefinition[] = [
  {
    "accountCode": null,
    "name": "BEBAN COMPENSATION AND BENEFIT - SITE",
    "costBehavior": null,
    "accountGroup": null,
    "subCategory": null,
    "isParent": true,
    "parentName": null
  },
  {
    "accountCode": "05110101",
    "name": "BEBAN GAJI KARYAWAN",
    "costBehavior": "VC",
    "accountGroup": "GKD",
    "subCategory": "GAJI",
    "isParent": false,
    "parentName": "BEBAN COMPENSATION AND BENEFIT - SITE"
  },
  {
    "accountCode": "05110102",
    "name": "BEBAN INCENTIVE",
    "costBehavior": "VC",
    "accountGroup": "ICTD",
    "subCategory": "GAJI",
    "isParent": false,
    "parentName": "BEBAN COMPENSATION AND BENEFIT - SITE"
  },
  {
    "accountCode": "05110103",
    "name": "BEBAN BONUS",
    "costBehavior": "FC",
    "accountGroup": "BNSD",
    "subCategory": "GAJI",
    "isParent": false,
    "parentName": "BEBAN COMPENSATION AND BENEFIT - SITE"
  },
  {
    "accountCode": "05110104",
    "name": "BEBAN THR KARYAWAN",
    "costBehavior": "FC",
    "accountGroup": "THRD",
    "subCategory": "GAJI",
    "isParent": false,
    "parentName": "BEBAN COMPENSATION AND BENEFIT - SITE"
  },
  {
    "accountCode": "05110105",
    "name": "BEBAN PHK KARYAWAN",
    "costBehavior": "FC",
    "accountGroup": "PHKD",
    "subCategory": "GAJI",
    "isParent": false,
    "parentName": "BEBAN COMPENSATION AND BENEFIT - SITE"
  },
  {
    "accountCode": "05110106",
    "name": "BEBAN TUNJANGAN PPH 21",
    "costBehavior": "VC",
    "accountGroup": "PPHD",
    "subCategory": "TUNJANGAN PPH 21",
    "isParent": false,
    "parentName": "BEBAN COMPENSATION AND BENEFIT - SITE"
  },
  {
    "accountCode": "05110107",
    "name": "BEBAN BPJS KETENAGAKERJAAN",
    "costBehavior": "FC",
    "accountGroup": "TKD",
    "subCategory": "BPJS KETENAGAKERJAAN",
    "isParent": false,
    "parentName": "BEBAN COMPENSATION AND BENEFIT - SITE"
  },
  {
    "accountCode": "05110108",
    "name": "BEBAN BPJS KESEHATAN",
    "costBehavior": "FC",
    "accountGroup": "KESD",
    "subCategory": "BPJS KESEHATAN",
    "isParent": false,
    "parentName": "BEBAN COMPENSATION AND BENEFIT - SITE"
  },
  {
    "accountCode": "05110109",
    "name": "BEBAN MEDICAL",
    "costBehavior": "VC",
    "accountGroup": "MCLD",
    "subCategory": "MEDICAL",
    "isParent": false,
    "parentName": "BEBAN COMPENSATION AND BENEFIT - SITE"
  },
  {
    "accountCode": "05110110",
    "name": "BEBAN KONSUMSI",
    "costBehavior": "VC",
    "accountGroup": "KSMD",
    "subCategory": "KONSUMSI (PACKMEAL)",
    "isParent": false,
    "parentName": "BEBAN COMPENSATION AND BENEFIT - SITE"
  },
  {
    "accountCode": "05110111",
    "name": "BEBAN SERAGAM",
    "costBehavior": "VC",
    "accountGroup": "SRGD",
    "subCategory": "SERAGAM",
    "isParent": false,
    "parentName": "BEBAN COMPENSATION AND BENEFIT - SITE"
  },
  {
    "accountCode": "05110112",
    "name": "BEBAN CUTI KARYAWAN",
    "costBehavior": "VC",
    "accountGroup": "CTD",
    "subCategory": "CUTI KARYAWAN",
    "isParent": false,
    "parentName": "BEBAN COMPENSATION AND BENEFIT - SITE"
  },
  {
    "accountCode": "05110199",
    "name": "BEBAN OTHERS - EMPLOYEE",
    "costBehavior": "FC",
    "accountGroup": "OTHD",
    "subCategory": "Allowance",
    "isParent": false,
    "parentName": "BEBAN COMPENSATION AND BENEFIT - SITE"
  },
  {
    "accountCode": null,
    "name": "BEBAN CONSUMABLES",
    "costBehavior": null,
    "accountGroup": null,
    "subCategory": null,
    "isParent": true,
    "parentName": null
  },
  {
    "accountCode": "05110201",
    "name": "BEBAN FUEL - PRODUCTION",
    "costBehavior": "VC",
    "accountGroup": "FLPRODD",
    "subCategory": "PRODUKSI",
    "isParent": false,
    "parentName": "BEBAN CONSUMABLES"
  },
  {
    "accountCode": "05110203",
    "name": "BEBAN TYRE",
    "costBehavior": "VC",
    "accountGroup": "TYR",
    "subCategory": "TYRE",
    "isParent": false,
    "parentName": "BEBAN CONSUMABLES"
  },
  {
    "accountCode": "05110208",
    "name": "BEBAN HANDLING FUEL",
    "costBehavior": "VC",
    "accountGroup": "HFL",
    "subCategory": "PRODUKSI",
    "isParent": false,
    "parentName": "BEBAN CONSUMABLES"
  },
  {
    "accountCode": "05110805",
    "name": "BEBAN MOB FUEL",
    "costBehavior": "VC",
    "accountGroup": "MOBFL",
    "subCategory": "PRODUKSI",
    "isParent": false,
    "parentName": "BEBAN CONSUMABLES"
  },
  {
    "accountCode": "05110204",
    "name": "BEBAN OLI",
    "costBehavior": "VC",
    "accountGroup": "OLI",
    "subCategory": "OLI",
    "isParent": false,
    "parentName": "BEBAN CONSUMABLES"
  },
  {
    "accountCode": "05110205",
    "name": "BEBAN GREASE",
    "costBehavior": "VC",
    "accountGroup": "GRS",
    "subCategory": "GREASE",
    "isParent": false,
    "parentName": "BEBAN CONSUMABLES"
  },
  {
    "accountCode": "05110206",
    "name": "BEBAN AD BLUE & ADDITIVE LAINNYA",
    "costBehavior": "VC",
    "accountGroup": "ADTD",
    "subCategory": "ADBLUE",
    "isParent": false,
    "parentName": "BEBAN CONSUMABLES"
  },
  {
    "accountCode": "05110207",
    "name": "BEBAN GROUND ENGAGE TOOLS",
    "costBehavior": "VC",
    "accountGroup": "GET",
    "subCategory": "ADBLUE",
    "isParent": false,
    "parentName": "BEBAN CONSUMABLES"
  },
  {
    "accountCode": "05110202",
    "name": "BEBAN FUEL - SUPPORT",
    "costBehavior": "FC",
    "accountGroup": "FLSUPP",
    "subCategory": "SUPPORT",
    "isParent": false,
    "parentName": "BEBAN CONSUMABLES"
  },
  {
    "accountCode": null,
    "name": "BEBAN SUB KONTRAKTOR",
    "costBehavior": null,
    "accountGroup": null,
    "subCategory": null,
    "isParent": true,
    "parentName": null
  },
  {
    "accountCode": "05110210",
    "name": "BEBAN RENTAL ALAT PRODUKSI",
    "costBehavior": "FC",
    "accountGroup": "RNTPR",
    "subCategory": "RENTAL ALAT PRODUKSI",
    "isParent": false,
    "parentName": "BEBAN SUB KONTRAKTOR"
  },
  {
    "accountCode": "05110211",
    "name": "BEBAN LICENSES OPERATION",
    "costBehavior": "FC",
    "accountGroup": "LCNOP",
    "subCategory": "OPEX",
    "isParent": false,
    "parentName": "BEBAN SUB KONTRAKTOR"
  },
  {
    "accountCode": null,
    "name": "BEBAN OPERASIONAL",
    "costBehavior": null,
    "accountGroup": null,
    "subCategory": null,
    "isParent": false,
    "parentName": "BEBAN SUB KONTRAKTOR"
  },
  {
    "accountCode": "05110299",
    "name": "HARGA POKOK PEMBELIAN",
    "costBehavior": "FC",
    "accountGroup": "HPPPB",
    "subCategory": null,
    "isParent": false,
    "parentName": "BEBAN SUB KONTRAKTOR"
  },
  {
    "accountCode": null,
    "name": "BEBAN LAINNYA",
    "costBehavior": null,
    "accountGroup": null,
    "subCategory": null,
    "isParent": false,
    "parentName": "BEBAN SUB KONTRAKTOR"
  },
  {
    "accountCode": "05111001",
    "name": "DISKON PEMBELIAN",
    "costBehavior": "FC",
    "accountGroup": "DPB",
    "subCategory": null,
    "isParent": false,
    "parentName": "BEBAN SUB KONTRAKTOR"
  },
  {
    "accountCode": "05111002",
    "name": "RETUR PEMBELIAN",
    "costBehavior": "FC",
    "accountGroup": "RPB",
    "subCategory": null,
    "isParent": false,
    "parentName": "BEBAN SUB KONTRAKTOR"
  },
  {
    "accountCode": "05111003",
    "name": "BEBAN SELISIH HARGA BARANG",
    "costBehavior": "FC",
    "accountGroup": "SLPB",
    "subCategory": null,
    "isParent": false,
    "parentName": "BEBAN SUB KONTRAKTOR"
  },
  {
    "accountCode": null,
    "name": "BEBAN REPAIRS & MAINTENANCE",
    "costBehavior": null,
    "accountGroup": null,
    "subCategory": null,
    "isParent": true,
    "parentName": null
  },
  {
    "accountCode": "05110301",
    "name": "BEBAN SPAREPART",
    "costBehavior": "VC",
    "accountGroup": "SPP",
    "subCategory": "SPAREPART",
    "isParent": false,
    "parentName": "BEBAN REPAIRS & MAINTENANCE"
  },
  {
    "accountCode": "05110302",
    "name": "BEBAN TOOLS",
    "costBehavior": "VC",
    "accountGroup": "TLS",
    "subCategory": "TOOLS",
    "isParent": false,
    "parentName": "BEBAN REPAIRS & MAINTENANCE"
  },
  {
    "accountCode": "05110303",
    "name": "BEBAN CONSUMABLE",
    "costBehavior": "VC",
    "accountGroup": "CSM",
    "subCategory": "CONSUMABLE",
    "isParent": false,
    "parentName": "BEBAN REPAIRS & MAINTENANCE"
  },
  {
    "accountCode": "05110304",
    "name": "BEBAN GENERAL SUPPLIES",
    "costBehavior": "VC",
    "accountGroup": "GSUP",
    "subCategory": "GENERAL SUPPLIES",
    "isParent": false,
    "parentName": "BEBAN REPAIRS & MAINTENANCE"
  },
  {
    "accountCode": "05110305",
    "name": "BEBAN EKSTERNAL SERVICES",
    "costBehavior": "VC",
    "accountGroup": "XSER",
    "subCategory": "TOOLS",
    "isParent": false,
    "parentName": "BEBAN REPAIRS & MAINTENANCE"
  },
  {
    "accountCode": "05110306",
    "name": "BEBAN EKSTERNAL SERVICES MATERIAL",
    "costBehavior": "VC",
    "accountGroup": "ESERM",
    "subCategory": "TOOLS",
    "isParent": false,
    "parentName": "BEBAN REPAIRS & MAINTENANCE"
  },
  {
    "accountCode": "05110307",
    "name": "BEBAN UNDERCARIAGE",
    "costBehavior": "VC",
    "accountGroup": "UCR",
    "subCategory": "TOOLS",
    "isParent": false,
    "parentName": "BEBAN REPAIRS & MAINTENANCE"
  },
  {
    "accountCode": null,
    "name": "BEBAN OVERHEAD COST - SITE",
    "costBehavior": null,
    "accountGroup": null,
    "subCategory": null,
    "isParent": true,
    "parentName": null
  },
  {
    "accountCode": "05110401",
    "name": "BEBAN LISTRIK, AIR, TELEPON, & INTERNET",
    "costBehavior": "FC",
    "accountGroup": "LATID",
    "subCategory": "OTHERS OVERHEAD",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110402",
    "name": "BEBAN ALAT TULIS KANTOR, FORM, & POS METERAI",
    "costBehavior": "FC",
    "accountGroup": "ATKD",
    "subCategory": "OTHERS OVERHEAD",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110403",
    "name": "BEBAN KURIR/EKSPEDISI",
    "costBehavior": "FC",
    "accountGroup": "EPDD",
    "subCategory": "OTHERS OVERHEAD",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110404",
    "name": "BEBAN PANTRIES & OTHERS",
    "costBehavior": "FC",
    "accountGroup": "PNTD",
    "subCategory": "OTHERS OVERHEAD",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "5110405",
    "name": "BEBAN RENTAL ALAT NON PRODUKSI",
    "costBehavior": "FC",
    "accountGroup": "RNTNPRD",
    "subCategory": "RENTAL LV + FT",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110406",
    "name": "BEBAN BBM, TOL, & PARKIR",
    "costBehavior": "FC",
    "accountGroup": "TPRD",
    "subCategory": "OTHERS OVERHEAD",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110407",
    "name": "BEBAN PERJALANAN DINAS",
    "costBehavior": "FC",
    "accountGroup": "DNSD",
    "subCategory": "OTHERS OVERHEAD",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110408",
    "name": "BEBAN INVENTARIS KANTOR",
    "costBehavior": "FC",
    "accountGroup": "INVD",
    "subCategory": "OPEX",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110409",
    "name": "BEBAN PEMELIHARAAN KANTOR",
    "costBehavior": "FC",
    "accountGroup": "MTNKD",
    "subCategory": "OPEX",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110410",
    "name": "BEBAN SEWA GEDUNG",
    "costBehavior": "FC",
    "accountGroup": "SWGD",
    "subCategory": "OPEX",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "5110411",
    "name": "BEBAN INFRASTRUKTUR",
    "costBehavior": "FC",
    "accountGroup": "INFD",
    "subCategory": "INFRASTRUKTUR",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110412",
    "name": "BEBAN SUMBANGAN & RETRIBUSI",
    "costBehavior": "FC",
    "accountGroup": "SRETD",
    "subCategory": "OTHERS OVERHEAD",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110413",
    "name": "BEBAN ENTERTAIN",
    "costBehavior": "FC",
    "accountGroup": "ENTD",
    "subCategory": "OPEX",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110414",
    "name": "BEBAN PROFESIONAL & KONSULTAN",
    "costBehavior": "FC",
    "accountGroup": "PROFD",
    "subCategory": "OPEX",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110415",
    "name": "BEBAN TRAINING",
    "costBehavior": "FC",
    "accountGroup": "TRND",
    "subCategory": "OPEX",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110416",
    "name": "BEBAN RECRUITMENT",
    "costBehavior": "FC",
    "accountGroup": "RCTD",
    "subCategory": "OPEX",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110417",
    "name": "BEBAN LICENSES & OTHER TAXES",
    "costBehavior": "FC",
    "accountGroup": "LCD",
    "subCategory": "OPEX",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110418",
    "name": "BEBAN LOW VALUE ASSET PROYEK",
    "costBehavior": "FC",
    "accountGroup": "LOWAP",
    "subCategory": "OPEX",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110499",
    "name": "BEBAN OTHERS - OVERHEAD",
    "costBehavior": "FC",
    "accountGroup": "OTHOHD",
    "subCategory": "OTHERS OVERHEAD",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110601",
    "name": "BEBAN PERLENGKAPAN DAN ALAT PELINDUNG DIRI",
    "costBehavior": "FC",
    "accountGroup": "APD",
    "subCategory": "APD",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110602",
    "name": "BEBAN SAFETY SIGNS",
    "costBehavior": "FC",
    "accountGroup": "SIG",
    "subCategory": "PERLENGKAPAN SAFETY",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110603",
    "name": "BEBAN ERP, HEALTH, & SERTIFICATION",
    "costBehavior": "FC",
    "accountGroup": "HLT",
    "subCategory": "PERLENGKAPAN SAFETY",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110604",
    "name": "BEBAN ENVIRONMENT",
    "costBehavior": "FC",
    "accountGroup": "EVR",
    "subCategory": "PERLENGKAPAN SAFETY",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110605",
    "name": "BEBAN KOORDINASI KEAMANAN",
    "costBehavior": "FC",
    "accountGroup": "SEC",
    "subCategory": "KEAMANAN",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110701",
    "name": "BEBAN SEWA MESS",
    "costBehavior": "FC",
    "accountGroup": "SWMS",
    "subCategory": "OPEX",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110702",
    "name": "BEBAN LAUNDRY",
    "costBehavior": "FC",
    "accountGroup": null,
    "subCategory": "LAUNDRY + HOUSEKEEPING",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110703",
    "name": "BEBAN HOUSEKEEPING",
    "costBehavior": "FC",
    "accountGroup": null,
    "subCategory": "LAUNDRY + HOUSEKEEPING",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110704",
    "name": "BEBAN CONSUMABLE MESS",
    "costBehavior": "FC",
    "accountGroup": "CSMS",
    "subCategory": "OTHERS OVERHEAD",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110705",
    "name": "BEBAN INVENTARIS MESS",
    "costBehavior": "FC",
    "accountGroup": "INVM",
    "subCategory": "INVENTARIS MESS",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110706",
    "name": "BEBAN PEMELIHARAAN MESS & INVENTARIS MESS",
    "costBehavior": "FC",
    "accountGroup": "MTMS",
    "subCategory": "PEMELIHARAAN MESS",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110501",
    "name": "BIAYA ASURANSI ASET",
    "costBehavior": "FC",
    "accountGroup": "ASAST",
    "subCategory": "ASURANSI",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110502",
    "name": "BIAYA ASURANSI MOBIL SARANA",
    "costBehavior": "FC",
    "accountGroup": "ASMS",
    "subCategory": "ASURANSI",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": "05110503",
    "name": "BIAYA ASURANSI INFRASTRUKTUR",
    "costBehavior": "FC",
    "accountGroup": "ASINF",
    "subCategory": "ASURANSI",
    "isParent": false,
    "parentName": "BEBAN OVERHEAD COST - SITE"
  },
  {
    "accountCode": null,
    "name": "BEBAN MOBILISASI",
    "costBehavior": null,
    "accountGroup": null,
    "subCategory": null,
    "isParent": true,
    "parentName": null
  },
  {
    "accountCode": "05110801",
    "name": "BEBAN MOB EQUIPMENT FLEET",
    "costBehavior": "VC",
    "accountGroup": "MOBEQP",
    "subCategory": "MOBILISASI",
    "isParent": false,
    "parentName": "BEBAN MOBILISASI"
  },
  {
    "accountCode": "05110802",
    "name": "BEBAN MOB SUPPORT EQUIPMENT",
    "costBehavior": "VC",
    "accountGroup": "MOBSUPEQP",
    "subCategory": "MOBILISASI",
    "isParent": false,
    "parentName": "BEBAN MOBILISASI"
  },
  {
    "accountCode": "05110803",
    "name": "BEBAN MOB SPAREPARTS",
    "costBehavior": "VC",
    "accountGroup": "MOBSPP",
    "subCategory": "MOBILISASI",
    "isParent": false,
    "parentName": "BEBAN MOBILISASI"
  },
  {
    "accountCode": "05110804",
    "name": "BEBAN MOB TYRES",
    "costBehavior": "VC",
    "accountGroup": "MOBTYR",
    "subCategory": "MOBILISASI",
    "isParent": false,
    "parentName": "BEBAN MOBILISASI"
  },
  {
    "accountCode": "05110806",
    "name": "BEBAN MOB OIL & GREASE",
    "costBehavior": "VC",
    "accountGroup": "MOBOLI",
    "subCategory": "MOBILISASI",
    "isParent": false,
    "parentName": "BEBAN MOBILISASI"
  },
  {
    "accountCode": null,
    "name": "BEBAN PENYUSUTAN DAN AMORTISASI - SITE",
    "costBehavior": null,
    "accountGroup": null,
    "subCategory": null,
    "isParent": true,
    "parentName": null
  },
  {
    "accountCode": "05110901",
    "name": "BEBAN PENYUSUTAN MESIN DAN PERALATAN",
    "costBehavior": "FC",
    "accountGroup": "PYMSN",
    "subCategory": "DEPRESIASI - SITE",
    "isParent": false,
    "parentName": "BEBAN PENYUSUTAN DAN AMORTISASI - SITE"
  },
  {
    "accountCode": "05110902",
    "name": "BEBAN PENYUSUTAN ALAT BERAT",
    "costBehavior": "FC",
    "accountGroup": "PYABT",
    "subCategory": "DEPRESIASI - SITE",
    "isParent": false,
    "parentName": "BEBAN PENYUSUTAN DAN AMORTISASI - SITE"
  },
  {
    "accountCode": "05110903",
    "name": "BEBAN PENYUSUTAN KENDARAAN",
    "costBehavior": "FC",
    "accountGroup": "PYVCH",
    "subCategory": "DEPRESIASI - SITE",
    "isParent": false,
    "parentName": "BEBAN PENYUSUTAN DAN AMORTISASI - SITE"
  },
  {
    "accountCode": "05110904",
    "name": "BEBAN PENYUSUTAN INVENTARIS MESS",
    "costBehavior": "FC",
    "accountGroup": "PYINVD",
    "subCategory": "DEPRESIASI - SITE",
    "isParent": false,
    "parentName": "BEBAN PENYUSUTAN DAN AMORTISASI - SITE"
  }
];

export const STANDARD_ACCOUNTS = ACCOUNT_DEFINITIONS.map((a) => a.name);

export const PARENT_ACCOUNT_NAMES = new Set(
  ACCOUNT_DEFINITIONS.filter((a) => a.isParent).map((a) => a.name)
);
