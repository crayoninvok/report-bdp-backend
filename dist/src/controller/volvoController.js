"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRawPositions = exports.getRawVehicles = exports.getLiveMonitoringUnits = void 0;
const https_1 = __importDefault(require("https"));
// In-memory cache for 15 seconds to prevent rate-limiting on Volvo API
let cachedData = null;
const CACHE_TTL_MS = 15000;
const VOLVO_AUTH = Buffer.from("D0F8071975:bnHLdWXITe").toString("base64");
function fetchFromVolvo(path, acceptHeader) {
    return new Promise((resolve, reject) => {
        const req = https_1.default.request({
            hostname: "api.volvotrucks.com",
            port: 443,
            path: path,
            method: "GET",
            headers: {
                Authorization: `Basic ${VOLVO_AUTH}`,
                Accept: acceptHeader,
                "User-Agent": "ReportCompany-Batara/1.0",
            },
            timeout: 10000,
        }, (res) => {
            let raw = "";
            res.on("data", (chunk) => (raw += chunk));
            res.on("end", () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(raw));
                    }
                    catch (e) {
                        reject(new Error(`Gagal mem-parsing response dari Volvo: ${raw.slice(0, 200)}`));
                    }
                }
                else {
                    reject(new Error(`Volvo API error (${res.statusCode}): ${raw.slice(0, 200) || "Unknown error"}`));
                }
            });
        });
        req.on("error", (err) => reject(err));
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Timeout menghubungi server Volvo Trucks API"));
        });
        req.end();
    });
}
/**
 * Controller: Get live monitoring units (merged vehicles + latest positions)
 */
const getLiveMonitoringUnits = async (req, res) => {
    try {
        const forceRefresh = req.query.force === "true";
        const now = Date.now();
        if (!forceRefresh && cachedData && now - cachedData.timestamp < CACHE_TTL_MS) {
            return res.json({
                ...cachedData.data,
                cached: true,
                cacheAgeMs: now - cachedData.timestamp,
            });
        }
        // Fetch vehicles and positions in parallel
        const [vehiclesPayload, positionsPayload] = await Promise.all([
            fetchFromVolvo("/vehicle/vehicles", "application/x.volvogroup.com.vehicles.v1.0+json"),
            fetchFromVolvo("/vehicle/vehiclepositions?latestOnly=true", "application/x.volvogroup.com.vehiclepositions.v1.0+json"),
        ]);
        const vehicles = vehiclesPayload?.vehicleResponse?.vehicles || [];
        const positions = positionsPayload?.vehiclePositionResponse?.vehiclePositions || [];
        // Map positions by VIN
        const positionMap = new Map();
        positions.forEach((pos) => {
            if (pos.vin) {
                positionMap.set(pos.vin, pos);
            }
        });
        let movingCount = 0;
        let idleCount = 0;
        let offlineCount = 0;
        let totalSpeed = 0;
        const units = vehicles.map((veh) => {
            const pos = positionMap.get(veh.vin);
            const gnss = pos?.gnssPosition;
            const latitude = gnss?.latitude != null ? Number(gnss.latitude) : null;
            const longitude = gnss?.longitude != null ? Number(gnss.longitude) : null;
            const speed = gnss?.speed != null ? Math.round(Number(gnss.speed) * 10) / 10 : 0;
            const heading = gnss?.heading != null ? Math.round(Number(gnss.heading)) : 0;
            const altitude = gnss?.altitude != null ? Math.round(Number(gnss.altitude)) : 0;
            const positionDateTime = gnss?.positionDateTime || pos?.receivedDateTime || null;
            // Extract PM name and chassis
            const fullName = veh.customerVehicleName || veh.vin;
            const parts = fullName.split("/");
            const pmNumber = parts[0]?.trim() || fullName;
            const chassisNumber = parts[1]?.trim() || "";
            // Determine movement status
            const hasGps = latitude !== null && longitude !== null;
            const isMoving = hasGps && speed > 1.5;
            let status = "idle";
            if (!hasGps) {
                status = "offline";
                offlineCount++;
            }
            else if (isMoving) {
                status = "moving";
                movingCount++;
                totalSpeed += speed;
            }
            else {
                status = "idle";
                idleCount++;
            }
            return {
                vin: veh.vin,
                customerVehicleName: fullName,
                pmNumber,
                chassisNumber,
                brand: veh.brand || "VOLVO TRUCKS",
                model: veh.model || "FH",
                type: veh.type || "TRUCK",
                emissionLevel: veh.emissionLevel,
                productionDate: veh.productionDate,
                latitude,
                longitude,
                heading,
                altitude,
                speed,
                wheelBasedSpeed: pos?.wheelBasedSpeed ?? 0,
                tachographSpeed: pos?.tachographSpeed ?? 0,
                positionDateTime,
                receivedDateTime: pos?.receivedDateTime || null,
                triggerType: pos?.triggerType?.triggerType || null,
                isMoving,
                hasGps,
                status,
            };
        });
        // Sort units: moving units first, then by pmNumber
        units.sort((a, b) => {
            if (a.isMoving !== b.isMoving)
                return a.isMoving ? -1 : 1;
            return a.pmNumber.localeCompare(b.pmNumber, undefined, { numeric: true });
        });
        const averageMovingSpeed = movingCount > 0 ? Math.round((totalSpeed / movingCount) * 10) / 10 : 0;
        const responseData = {
            success: true,
            summary: {
                totalUnits: units.length,
                movingUnits: movingCount,
                idleUnits: idleCount,
                offlineUnits: offlineCount,
                averageMovingSpeed,
                serverTime: new Date().toISOString(),
            },
            data: units,
        };
        cachedData = {
            timestamp: Date.now(),
            data: responseData,
        };
        return res.json({
            ...responseData,
            cached: false,
        });
    }
    catch (error) {
        console.error("Error in getLiveMonitoringUnits:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Gagal mengambil data Live Monitoring dari Volvo API",
        });
    }
};
exports.getLiveMonitoringUnits = getLiveMonitoringUnits;
/**
 * Controller: Raw vehicles endpoint
 */
const getRawVehicles = async (req, res) => {
    try {
        const data = await fetchFromVolvo("/vehicle/vehicles", "application/x.volvogroup.com.vehicles.v1.0+json");
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getRawVehicles = getRawVehicles;
/**
 * Controller: Raw vehicle positions endpoint
 */
const getRawPositions = async (req, res) => {
    try {
        const data = await fetchFromVolvo("/vehicle/vehiclepositions?latestOnly=true", "application/x.volvogroup.com.vehiclepositions.v1.0+json");
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getRawPositions = getRawPositions;
