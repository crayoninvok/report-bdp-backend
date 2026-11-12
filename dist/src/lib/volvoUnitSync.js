"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORT_CATEGORY_NAMES = exports.SUPPORT_UNIT_TYPES = exports.TRAILER_CATEGORIES = exports.HAULING_CATEGORIES = void 0;
exports.isHaulingCategory = isHaulingCategory;
exports.resolveSupportUnitType = resolveSupportUnitType;
exports.parseNonNegativeMeterInput = parseNonNegativeMeterInput;
exports.buildHaulingSetForPm = buildHaulingSetForPm;
exports.syncVolvoPrimeMoversToMasterUnits = syncVolvoPrimeMoversToMasterUnits;
const prisma_1 = require("./prisma");
const volvoClient_1 = require("./volvoClient");
exports.HAULING_CATEGORIES = [
    "Prime Mover",
    "Vessel 1",
    "Dolly",
    "Vessel 2",
];
exports.TRAILER_CATEGORIES = ["Vessel 1", "Dolly", "Vessel 2"];
exports.SUPPORT_UNIT_TYPES = [
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
];
exports.SUPPORT_CATEGORY_NAMES = exports.SUPPORT_UNIT_TYPES.map((t) => t.category);
const SUPPORT_ALIAS_MAP = new Map([
    ["lv", exports.SUPPORT_UNIT_TYPES[0]],
    ["light vehicle", exports.SUPPORT_UNIT_TYPES[0]],
    ["light vechicle", exports.SUPPORT_UNIT_TYPES[0]],
    ["light vechicle (lv)", exports.SUPPORT_UNIT_TYPES[0]],
    ["light vehicle (lv)", exports.SUPPORT_UNIT_TYPES[0]],
    ["th", exports.SUPPORT_UNIT_TYPES[1]],
    ["telehandler", exports.SUPPORT_UNIT_TYPES[1]],
    ["telehendler", exports.SUPPORT_UNIT_TYPES[1]],
    ["telehandler (th)", exports.SUPPORT_UNIT_TYPES[1]],
    ["telehendler (th)", exports.SUPPORT_UNIT_TYPES[1]],
    ["ft", exports.SUPPORT_UNIT_TYPES[2]],
    ["fuel truck", exports.SUPPORT_UNIT_TYPES[2]],
    ["fuel truck (ft)", exports.SUPPORT_UNIT_TYPES[2]],
    ["st", exports.SUPPORT_UNIT_TYPES[3]],
    ["storing truck", exports.SUPPORT_UNIT_TYPES[3]],
    ["storing truct", exports.SUPPORT_UNIT_TYPES[3]],
    ["storing truck (st)", exports.SUPPORT_UNIT_TYPES[3]],
    ["storing truct (st)", exports.SUPPORT_UNIT_TYPES[3]],
    ["wt", exports.SUPPORT_UNIT_TYPES[4]],
    ["water truck", exports.SUPPORT_UNIT_TYPES[4]],
    ["water truck (wt)", exports.SUPPORT_UNIT_TYPES[4]],
    ["am", exports.SUPPORT_UNIT_TYPES[5]],
    ["ambulance", exports.SUPPORT_UNIT_TYPES[5]],
    ["ambulance (am)", exports.SUPPORT_UNIT_TYPES[5]],
    ["bm", exports.SUPPORT_UNIT_TYPES[6]],
    ["bus manhaul", exports.SUPPORT_UNIT_TYPES[6]],
    ["bus manhaul (bm)", exports.SUPPORT_UNIT_TYPES[6]],
    ["ex", exports.SUPPORT_UNIT_TYPES[7]],
    ["excavator", exports.SUPPORT_UNIT_TYPES[7]],
    ["excavator (ex)", exports.SUPPORT_UNIT_TYPES[7]],
    ["dt", exports.SUPPORT_UNIT_TYPES[8]],
    ["dump truck", exports.SUPPORT_UNIT_TYPES[8]],
    ["dump truck (dt)", exports.SUPPORT_UNIT_TYPES[8]],
    ["cp", exports.SUPPORT_UNIT_TYPES[9]],
    ["compactor", exports.SUPPORT_UNIT_TYPES[9]],
    ["compactor (cp)", exports.SUPPORT_UNIT_TYPES[9]],
    ["dz", exports.SUPPORT_UNIT_TYPES[10]],
    ["dozer", exports.SUPPORT_UNIT_TYPES[10]],
    ["dozer (dz)", exports.SUPPORT_UNIT_TYPES[10]],
    ["gs", exports.SUPPORT_UNIT_TYPES[11]],
    ["genset", exports.SUPPORT_UNIT_TYPES[11]],
    ["genset (gs)", exports.SUPPORT_UNIT_TYPES[11]],
]);
/** Checks if category belongs to hauling fleet managed via Volvo Connect. */
function isHaulingCategory(category) {
    const norm = (category || "").trim().toLowerCase();
    return exports.HAULING_CATEGORIES.some((c) => c.toLowerCase() === norm);
}
/** Resolves a user-supplied support category/prefix/alias to canonical entry. */
function resolveSupportUnitType(raw) {
    if (!raw)
        return null;
    const norm = raw.trim().toLowerCase();
    return SUPPORT_ALIAS_MAP.get(norm) ?? null;
}
/** Parses an optional non-negative meter value (HM or KM) from request input. */
function parseNonNegativeMeterInput(raw, label, decimals = 1) {
    if (raw === undefined) {
        return { value: undefined };
    }
    if (raw === null || String(raw).trim() === "") {
        return { value: null };
    }
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) {
        return {
            value: undefined,
            error: `Nilai ${label} harus berupa angka >= 0.`,
        };
    }
    const factor = Math.pow(10, decimals);
    return { value: Math.round(num * factor) / factor };
}
/**
 * Computes paired Vessel 1, Dolly (DL60), and Vessel 2 specs for a Volvo Prime Mover code.
 * Matches existing numbering (PM401..PM499 -> pairIndex 1..99 -> ST8xx/DL6xx/ST9xx)
 * and shifts >= 500 out of the 800/900 band to avoid ST901+ collisions.
 */
function buildHaulingSetForPm(pmCode, rawModel) {
    const match = /^PM(\d+)$/i.exec(pmCode.trim().toUpperCase());
    if (!match)
        return null;
    const pmNum = parseInt(match[1], 10);
    if (!Number.isFinite(pmNum) || pmNum <= 0)
        return null;
    const pairIndex = pmNum > 400 ? pmNum - 400 : pmNum;
    const inStandardBand = pmNum > 400 && pmNum < 500;
    const v1Num = inStandardBand ? 800 + pairIndex : 1000 + pairIndex;
    const dlNum = inStandardBand ? 600 + pairIndex : 1000 + pairIndex;
    const v2Num = inStandardBand ? 900 + pairIndex : 2000 + pairIndex;
    const normalizedModel = rawModel && !rawModel.trim().toUpperCase().startsWith("FH")
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
                category: "Vessel 1",
                brand: "Korindo",
                model: "SDT110",
            },
            {
                unitCode: `DL${dlNum}`,
                unitNumber: dlNum,
                category: "Dolly",
                brand: "Korindo",
                model: "DL60",
            },
            {
                unitCode: `ST${v2Num}`,
                unitNumber: v2Num,
                category: "Vessel 2",
                brand: "Korindo",
                model: "SDT125",
            },
        ],
    };
}
const VOLVO_UNIT_SYNC_TTL_MS = 5 * 60 * 1000;
let lastSyncResult = null;
let inFlightSync = null;
/**
 * Pulls registered vehicles from Volvo Connect and auto-creates any new
 * Prime Mover along with its coupled Vessel 1, Dolly (DL60), and Vessel 2.
 * Existing MasterUnit rows (jobSite, status, brand/model revisions like CIMC) are preserved.
 */
async function syncVolvoPrimeMoversToMasterUnits(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh &&
        lastSyncResult &&
        now - lastSyncResult.timestamp < VOLVO_UNIT_SYNC_TTL_MS) {
        return { ...lastSyncResult.result, skippedCache: true };
    }
    if (inFlightSync) {
        return inFlightSync;
    }
    inFlightSync = (async () => {
        try {
            const telemetryRes = await (0, volvoClient_1.getVolvoTelemetryMap)(forceRefresh);
            if (telemetryRes.error && telemetryRes.map.size === 0) {
                return {
                    syncedAt: new Date().toISOString(),
                    totalVolvoVehicles: 0,
                    createdCount: 0,
                    newPrimeMovers: [],
                    newTrailers: [],
                    error: telemetryRes.error,
                };
            }
            const vehicles = Array.from(telemetryRes.map.values());
            const existingUnits = await prisma_1.prisma.masterUnit.findMany({
                select: {
                    unitCode: true,
                    category: true,
                    headUnitCode: true,
                    jobSite: true,
                    status: true,
                },
            });
            const existingByCode = new Map(existingUnits.map((u) => [u.unitCode, u]));
            const trailerCategoriesByHead = new Map();
            for (const u of existingUnits) {
                if (!u.headUnitCode)
                    continue;
                if (!trailerCategoriesByHead.has(u.headUnitCode)) {
                    trailerCategoriesByHead.set(u.headUnitCode, new Set());
                }
                trailerCategoriesByHead.get(u.headUnitCode).add(u.category);
            }
            const toCreate = [];
            const newPrimeMovers = [];
            const newTrailers = [];
            const queuedCodes = new Set();
            for (const tel of vehicles) {
                const pairing = buildHaulingSetForPm(tel.unitCode, tel.model);
                if (!pairing)
                    continue;
                const existingPm = existingByCode.get(pairing.pmCode);
                const targetSite = existingPm?.jobSite || "MuaraPahu";
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
                        currentHm: tel.hm ?? null,
                        currentKm: tel.km ?? null,
                    });
                    queuedCodes.add(pairing.pmCode);
                    newPrimeMovers.push(pairing.pmCode);
                }
                const attachedCats = trailerCategoriesByHead.get(pairing.pmCode);
                for (const tr of pairing.trailers) {
                    const alreadyHasCategory = attachedCats?.has(tr.category);
                    if (alreadyHasCategory ||
                        existingByCode.has(tr.unitCode) ||
                        queuedCodes.has(tr.unitCode)) {
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
                        currentHm: null,
                        currentKm: null,
                    });
                    queuedCodes.add(tr.unitCode);
                    newTrailers.push(tr.unitCode);
                }
            }
            let createdCount = 0;
            if (toCreate.length > 0) {
                const res = await prisma_1.prisma.masterUnit.createMany({
                    data: toCreate,
                    skipDuplicates: true,
                });
                createdCount = res.count;
            }
            const result = {
                syncedAt: new Date().toISOString(),
                totalVolvoVehicles: vehicles.length,
                createdCount,
                newPrimeMovers,
                newTrailers,
            };
            lastSyncResult = { timestamp: Date.now(), result };
            return result;
        }
        catch (err) {
            return {
                syncedAt: new Date().toISOString(),
                totalVolvoVehicles: 0,
                createdCount: 0,
                newPrimeMovers: [],
                newTrailers: [],
                error: err?.message || "Gagal menyinkronkan data dari Volvo Connect",
            };
        }
        finally {
            inFlightSync = null;
        }
    })();
    return inFlightSync;
}
