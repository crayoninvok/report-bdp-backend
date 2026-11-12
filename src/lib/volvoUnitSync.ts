import { JobSite } from "../generated/prisma/client";
import { prisma } from "./prisma";
import { fetchFromVolvo } from "./volvoClient";

export const HAULING_CATEGORIES = [
  "Prime Mover",
  "Vessel 1",
  "Dolly",
  "Vessel 2",
] as const;

export const TRAILER_CATEGORIES = ["Vessel 1", "Dolly", "Vessel 2"] as const;

export const SUPPORT_UNIT_TYPES = [
  { prefix: "LV", category: "Light Vehicle", label: "Light Vehicle (LV)" },
  { prefix: "TH", category: "Telehandler", label: "Telehandler (TH)" },
  { prefix: "FT", category: "Fuel Truck", label: "Fuel Truck (FT)" },
  { prefix: "ST", category: "Storing Truck", label: "Storing Truck (ST)" },
  { prefix: "WT", category: "Water Truck", label: "Water Truck (WT)" },
  { prefix: "AM", category: "Ambulance", label: "Ambulance (AM)" },
  { prefix: "BM", category: "Bus Manhaul", label: "Bus Manhaul (BM)" },
  { prefix: "EX", category: "Excavator", label: "Excavator (EX)" },
  { prefix: "DT", category: "Dump Truck", label: "Dump Truck (DT)" },
  { prefix: "CP", category: "Compactor", label: "Compactor (CP)" },
  { prefix: "DZ", category: "Dozer", label: "Dozer (DZ)" },
  { prefix: "GS", category: "Genset", label: "Genset (GS)" },
] as const;

export const SUPPORT_CATEGORY_NAMES = SUPPORT_UNIT_TYPES.map((t) => t.category);

const SUPPORT_ALIAS_MAP = new Map<string, (typeof SUPPORT_UNIT_TYPES)[number]>([
  ["lv", SUPPORT_UNIT_TYPES[0]],
  ["light vehicle", SUPPORT_UNIT_TYPES[0]],
  ["light vechicle", SUPPORT_UNIT_TYPES[0]],
  ["light vechicle (lv)", SUPPORT_UNIT_TYPES[0]],
  ["light vehicle (lv)", SUPPORT_UNIT_TYPES[0]],
  ["th", SUPPORT_UNIT_TYPES[1]],
  ["telehandler", SUPPORT_UNIT_TYPES[1]],
  ["telehendler", SUPPORT_UNIT_TYPES[1]],
  ["telehandler (th)", SUPPORT_UNIT_TYPES[1]],
  ["telehendler (th)", SUPPORT_UNIT_TYPES[1]],
  ["ft", SUPPORT_UNIT_TYPES[2]],
  ["fuel truck", SUPPORT_UNIT_TYPES[2]],
  ["fuel truck (ft)", SUPPORT_UNIT_TYPES[2]],
  ["st", SUPPORT_UNIT_TYPES[3]],
  ["storing truck", SUPPORT_UNIT_TYPES[3]],
  ["storing truct", SUPPORT_UNIT_TYPES[3]],
  ["storing truck (st)", SUPPORT_UNIT_TYPES[3]],
  ["storing truct (st)", SUPPORT_UNIT_TYPES[3]],
  ["wt", SUPPORT_UNIT_TYPES[4]],
  ["water truck", SUPPORT_UNIT_TYPES[4]],
  ["water truck (wt)", SUPPORT_UNIT_TYPES[4]],
  ["am", SUPPORT_UNIT_TYPES[5]],
  ["ambulance", SUPPORT_UNIT_TYPES[5]],
  ["ambulance (am)", SUPPORT_UNIT_TYPES[5]],
  ["bm", SUPPORT_UNIT_TYPES[6]],
  ["bus manhaul", SUPPORT_UNIT_TYPES[6]],
  ["bus manhaul (bm)", SUPPORT_UNIT_TYPES[6]],
  ["ex", SUPPORT_UNIT_TYPES[7]],
  ["excavator", SUPPORT_UNIT_TYPES[7]],
  ["excavator (ex)", SUPPORT_UNIT_TYPES[7]],
  ["dt", SUPPORT_UNIT_TYPES[8]],
  ["dump truck", SUPPORT_UNIT_TYPES[8]],
  ["dump truck (dt)", SUPPORT_UNIT_TYPES[8]],
  ["cp", SUPPORT_UNIT_TYPES[9]],
  ["compactor", SUPPORT_UNIT_TYPES[9]],
  ["compactor (cp)", SUPPORT_UNIT_TYPES[9]],
  ["dz", SUPPORT_UNIT_TYPES[10]],
  ["dozer", SUPPORT_UNIT_TYPES[10]],
  ["dozer (dz)", SUPPORT_UNIT_TYPES[10]],
  ["gs", SUPPORT_UNIT_TYPES[11]],
  ["genset", SUPPORT_UNIT_TYPES[11]],
  ["genset (gs)", SUPPORT_UNIT_TYPES[11]],
]);

/** Checks if category belongs to hauling fleet managed via Volvo Connect. */
export function isHaulingCategory(category?: string | null): boolean {
  const norm = (category || "").trim().toLowerCase();
  return HAULING_CATEGORIES.some((c) => c.toLowerCase() === norm);
}

/** Resolves a user-supplied support category/prefix/alias to canonical entry. */
export function resolveSupportUnitType(
  raw?: string | null
): (typeof SUPPORT_UNIT_TYPES)[number] | null {
  if (!raw) return null;
  const norm = raw.trim().toLowerCase();
  return SUPPORT_ALIAS_MAP.get(norm) ?? null;
}

/**
 * Computes paired Vessel 1, Dolly (DL60), and Vessel 2 specs for a Volvo Prime Mover code.
 * Matches existing numbering (PM401..PM499 -> pairIndex 1..99 -> ST8xx/DL6xx/ST9xx)
 * and shifts >= 500 out of the 800/900 band to avoid ST901+ collisions.
 */
export function buildHaulingSetForPm(pmCode: string, rawModel?: string | null) {
  const match = /^PM(\d+)$/i.exec(pmCode.trim().toUpperCase());
  if (!match) return null;

  const pmNum = parseInt(match[1], 10);
  if (!Number.isFinite(pmNum) || pmNum <= 0) return null;

  const pairIndex = pmNum > 400 ? pmNum - 400 : pmNum;
  const inStandardBand = pmNum > 400 && pmNum < 500;
  const v1Num = inStandardBand ? 800 + pairIndex : 1000 + pairIndex;
  const dlNum = inStandardBand ? 600 + pairIndex : 1000 + pairIndex;
  const v2Num = inStandardBand ? 900 + pairIndex : 2000 + pairIndex;

  const normalizedModel =
    rawModel && !rawModel.trim().toUpperCase().startsWith("FH")
      ? rawModel.trim()
      : "FH16";

  return {
    pmCode: `PM${pmNum}`,
    pmNum,
    pairIndex,
    pmModel: normalizedModel,
    trailers: [
      {
        unitCode: `ST${v1Num}`,
        unitNumber: v1Num,
        category: "Vessel 1" as const,
        brand: "Korindo",
        model: "SDT110",
      },
      {
        unitCode: `DL${dlNum}`,
        unitNumber: dlNum,
        category: "Dolly" as const,
        brand: "Korindo",
        model: "DL60",
      },
      {
        unitCode: `ST${v2Num}`,
        unitNumber: v2Num,
        category: "Vessel 2" as const,
        brand: "Korindo",
        model: "SDT125",
      },
    ],
  };
}

export interface VolvoSyncResult {
  syncedAt: string;
  totalVolvoVehicles: number;
  createdCount: number;
  newPrimeMovers: string[];
  newTrailers: string[];
  skippedCache?: boolean;
  error?: string;
}

const VOLVO_UNIT_SYNC_TTL_MS = 5 * 60 * 1000;
let lastSyncResult: { timestamp: number; result: VolvoSyncResult } | null = null;
let inFlightSync: Promise<VolvoSyncResult> | null = null;

/**
 * Pulls registered vehicles from Volvo Connect and auto-creates any new
 * Prime Mover along with its coupled Vessel 1, Dolly (DL60), and Vessel 2.
 * Existing MasterUnit rows (jobSite, status, brand/model revisions like CIMC) are preserved.
 */
export async function syncVolvoPrimeMoversToMasterUnits(
  forceRefresh = false
): Promise<VolvoSyncResult> {
  const now = Date.now();
  if (
    !forceRefresh &&
    lastSyncResult &&
    now - lastSyncResult.timestamp < VOLVO_UNIT_SYNC_TTL_MS
  ) {
    return { ...lastSyncResult.result, skippedCache: true };
  }

  if (inFlightSync) {
    return inFlightSync;
  }

  inFlightSync = (async () => {
    try {
      const payload = await fetchFromVolvo(
        "/vehicle/vehicles",
        "application/x.volvogroup.com.vehicles.v1.0+json"
      );
      const vehicles: any[] = payload?.vehicleResponse?.vehicles || [];

      const existingUnits = await prisma.masterUnit.findMany({
        select: {
          unitCode: true,
          category: true,
          headUnitCode: true,
          jobSite: true,
          status: true,
        },
      });

      const existingByCode = new Map(existingUnits.map((u) => [u.unitCode, u]));
      const trailerCategoriesByHead = new Map<string, Set<string>>();
      for (const u of existingUnits) {
        if (!u.headUnitCode) continue;
        if (!trailerCategoriesByHead.has(u.headUnitCode)) {
          trailerCategoriesByHead.set(u.headUnitCode, new Set());
        }
        trailerCategoriesByHead.get(u.headUnitCode)!.add(u.category);
      }

      const toCreate: Array<{
        unitCode: string;
        unitNumber: number;
        category: string;
        brand: string;
        model: string;
        headUnitCode: string;
        pairIndex: number;
        jobSite: JobSite;
        status: string;
      }> = [];
      const newPrimeMovers: string[] = [];
      const newTrailers: string[] = [];
      const queuedCodes = new Set<string>();

      for (const veh of vehicles) {
        const fullName: string = veh.customerVehicleName || veh.vin || "";
        const rawPm = fullName.split("/")[0]?.trim() || "";
        const normalizedCode = rawPm.replace(/\s+/g, "").toUpperCase();
        const pairing = buildHaulingSetForPm(normalizedCode, veh.model);
        if (!pairing) continue;

        const existingPm = existingByCode.get(pairing.pmCode);
        const targetSite: JobSite = existingPm?.jobSite || "MuaraPahu";
        const targetStatus = existingPm?.status || "Active";

        if (!existingPm && !queuedCodes.has(pairing.pmCode)) {
          toCreate.push({
            unitCode: pairing.pmCode,
            unitNumber: pairing.pmNum,
            category: "Prime Mover",
            brand: "Volvo",
            model: pairing.pmModel,
            headUnitCode: pairing.pmCode,
            pairIndex: pairing.pairIndex,
            jobSite: targetSite,
            status: targetStatus,
          });
          queuedCodes.add(pairing.pmCode);
          newPrimeMovers.push(pairing.pmCode);
        }

        const attachedCats = trailerCategoriesByHead.get(pairing.pmCode);
        for (const tr of pairing.trailers) {
          const alreadyHasCategory = attachedCats?.has(tr.category);
          if (
            alreadyHasCategory ||
            existingByCode.has(tr.unitCode) ||
            queuedCodes.has(tr.unitCode)
          ) {
            continue;
          }
          toCreate.push({
            unitCode: tr.unitCode,
            unitNumber: tr.unitNumber,
            category: tr.category,
            brand: tr.brand,
            model: tr.model,
            headUnitCode: pairing.pmCode,
            pairIndex: pairing.pairIndex,
            jobSite: targetSite,
            status: targetStatus,
          });
          queuedCodes.add(tr.unitCode);
          newTrailers.push(tr.unitCode);
        }
      }

      let createdCount = 0;
      if (toCreate.length > 0) {
        const res = await prisma.masterUnit.createMany({
          data: toCreate,
          skipDuplicates: true,
        });
        createdCount = res.count;
      }

      const result: VolvoSyncResult = {
        syncedAt: new Date().toISOString(),
        totalVolvoVehicles: vehicles.length,
        createdCount,
        newPrimeMovers,
        newTrailers,
      };
      lastSyncResult = { timestamp: Date.now(), result };
      return result;
    } catch (err: any) {
      return {
        syncedAt: new Date().toISOString(),
        totalVolvoVehicles: 0,
        createdCount: 0,
        newPrimeMovers: [],
        newTrailers: [],
        error: err?.message || "Gagal menyinkronkan data dari Volvo Connect",
      };
    } finally {
      inFlightSync = null;
    }
  })();

  return inFlightSync;
}
