import https from "https";

const VOLVO_AUTH = Buffer.from(
  process.env.VOLVO_CONNECT_AUTH || "D0F8071975:bnHLdWXITe"
).toString("base64");

export function fetchFromVolvo(path: string, acceptHeader: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.volvotrucks.com",
        port: 443,
        path,
        method: "GET",
        headers: {
          Authorization: `Basic ${VOLVO_AUTH}`,
          Accept: acceptHeader,
          "User-Agent": "ReportCompany-Batara/1.0",
        },
        timeout: 10000,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(raw));
            } catch {
              reject(new Error(`Gagal mem-parsing response dari Volvo: ${raw.slice(0, 200)}`));
            }
          } else {
            reject(
              new Error(
                `Volvo API error (${res.statusCode}): ${raw.slice(0, 200) || "Unknown error"}`
              )
            );
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout menghubungi server Volvo Trucks API"));
    });
    req.end();
  });
}

export interface VolvoUnitTelemetry {
  unitCode: string;
  pmNumber: string;
  vin: string;
  model: string;
  km: number;
  hm: number;
  fuelLevel: number | null;
  lastUpdated: string | null;
}

let telemetryCache: {
  timestamp: number;
  map: Map<string, VolvoUnitTelemetry>;
  fetchedAt: string;
} | null = null;

const TELEMETRY_CACHE_TTL_MS = 30000;

/**
 * Fetches live Odometer (KM) and Engine Hours (HM) for all Volvo Prime Movers,
 * keyed by normalized MasterUnit unitCode (e.g. "PM439").
 */
export async function getVolvoTelemetryMap(forceRefresh = false): Promise<{
  map: Map<string, VolvoUnitTelemetry>;
  onlineCount: number;
  fetchedAt: string | null;
  error?: string;
}> {
  const now = Date.now();
  if (!forceRefresh && telemetryCache && now - telemetryCache.timestamp < TELEMETRY_CACHE_TTL_MS) {
    return {
      map: telemetryCache.map,
      onlineCount: telemetryCache.map.size,
      fetchedAt: telemetryCache.fetchedAt,
    };
  }

  try {
    const [vehiclesPayload, statusesPayload] = await Promise.all([
      fetchFromVolvo("/vehicle/vehicles", "application/x.volvogroup.com.vehicles.v1.0+json"),
      fetchFromVolvo(
        "/vehicle/vehiclestatuses?latestOnly=true",
        "application/x.volvogroup.com.vehiclestatuses.v1.0+json"
      ),
    ]);

    const vehicles: any[] = vehiclesPayload?.vehicleResponse?.vehicles || [];
    const statuses: any[] = statusesPayload?.vehicleStatusResponse?.vehicleStatuses || [];

    const statusByVin = new Map<string, any>();
    for (const s of statuses) {
      if (s?.vin) statusByVin.set(s.vin, s);
    }

    const resultMap = new Map<string, VolvoUnitTelemetry>();
    for (const veh of vehicles) {
      const fullName: string = veh.customerVehicleName || veh.vin || "";
      const rawPm = fullName.split("/")[0]?.trim() || fullName;
      const normalizedCode = rawPm.replace(/\s+/g, "").toUpperCase();
      if (!normalizedCode) continue;

      const st = statusByVin.get(veh.vin);
      const km =
        st?.hrTotalVehicleDistance != null
          ? Math.round(Number(st.hrTotalVehicleDistance) / 1000)
          : 0;
      const hm =
        st?.totalEngineHours != null
          ? Math.round(Number(st.totalEngineHours) * 10) / 10
          : 0;
      const fuelLevel =
        st?.snapshotData?.fuelLevel1 != null ? Number(st.snapshotData.fuelLevel1) : null;
      const lastUpdated =
        st?.createdDateTime || st?.receivedDateTime || null;

      resultMap.set(normalizedCode, {
        unitCode: normalizedCode,
        pmNumber: rawPm,
        vin: veh.vin,
        model: veh.model || "FH16",
        km,
        hm,
        fuelLevel,
        lastUpdated,
      });
    }

    const fetchedAt = new Date().toISOString();
    telemetryCache = {
      timestamp: Date.now(),
      map: resultMap,
      fetchedAt,
    };

    return {
      map: resultMap,
      onlineCount: resultMap.size,
      fetchedAt,
    };
  } catch (err: any) {
    console.warn("Volvo telemetry fallback:", err.message);
    if (telemetryCache) {
      return {
        map: telemetryCache.map,
        onlineCount: telemetryCache.map.size,
        fetchedAt: telemetryCache.fetchedAt,
        error: err.message,
      };
    }
    return {
      map: new Map(),
      onlineCount: 0,
      fetchedAt: null,
      error: err.message,
    };
  }
}

