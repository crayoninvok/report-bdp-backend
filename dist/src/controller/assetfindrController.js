"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assetfindrController = void 0;
const ASSETFINDR_BASE_URL = "https://api.assetfindr.com";
const ASSETFINDR_FIREBASE_API_KEY = "AIzaSyAaLQ5r471mDX_Q9IpxM55o67bCf956P04";
const DEFAULT_CLIENT_ID = "batara";
const INDO_DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const INDO_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
const dailyProductionCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes in-memory cache
/**
 * Format date string to RFC3339 / ISO-8601 required by AssetFindr API
 * e.g., '2026-10-30' -> '2026-10-30T00:00:00+07:00'
 */
function formatToISO(dateStr, type = "start") {
    if (!dateStr || !dateStr.trim())
        return "";
    const s = dateStr.trim();
    if (s.includes("T"))
        return s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return type === "start" ? `${s}T00:00:00+07:00` : `${s}T23:59:59+07:00`;
    }
    return s;
}
/**
 * Helper to match ticket against jobsite ('all', 'senyiur', 'muara_pahu')
 */
function matchesJobsite(t, jobsite) {
    if (!jobsite || jobsite === "all")
        return true;
    const s = [
        t.inbound_location_main_location_name,
        t.inbound_weight_bridge_location_main_location_name,
        t.outbound_location_main_location_name,
        t.outbound_weight_bridge_location_main_location_name,
        t.location_route?.start_location_name,
        t.location_route?.start_main_location_name,
        t.location_route?.end_location_name,
        t.location_route?.end_main_location_name,
        t.inbound_location_label,
        t.outbound_location_label,
        t.inbound_weight_bridge_location_label,
        t.outbound_weight_bridge_location_label,
        t.reference_id,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    if (jobsite === "senyiur") {
        return s.includes("senyiur") || s.includes("tj") || s.includes("amm") || s.includes("bt");
    }
    if (jobsite === "muara_pahu" || jobsite === "muarapahu") {
        return s.includes("muara pahu") || s.includes("mp");
    }
    return true;
}
/**
 * Generate simulated daily production from startDate to endDate
 */
function generateDemoDailyProduction(startDate, endDate, jobsite = "all") {
    const daysMap = {};
    const startDt = new Date(startDate);
    const endDt = new Date(endDate);
    const curDt = new Date(startDt);
    const factor = jobsite === "senyiur" ? 0.45 : jobsite === "muara_pahu" ? 0.55 : 1.0;
    let grandTotalTonaseDS = 0;
    let grandTotalRitaseDS = 0;
    let grandTotalTonaseNS = 0;
    let grandTotalRitaseNS = 0;
    while (curDt <= endDt) {
        const dStr = curDt.toISOString().slice(0, 10);
        const dayOfWeek = curDt.getDay();
        const dateNum = curDt.getDate();
        const monthNum = curDt.getMonth();
        const dayName = INDO_DAYS[dayOfWeek];
        const displayDate = `${dayName}, ${String(dateNum).padStart(2, "0")} ${INDO_MONTHS[monthNum]}`;
        // Deterministic pseudo-random generation
        const seed = (dateNum * 17 + monthNum * 31) % 100;
        const baseRitDS = 35 + (seed % 25);
        const ritaseDS = Math.max(1, Math.round(baseRitDS * factor));
        const tonaseDS = Math.round((ritaseDS * (210 + (seed % 15))) * 10) / 10;
        const baseRitNS = 38 + ((seed + 7) % 28);
        const ritaseNS = Math.max(1, Math.round(baseRitNS * factor));
        const tonaseNS = Math.round((ritaseNS * (212 + ((seed + 5) % 15))) * 10) / 10;
        const totalRitase = ritaseDS + ritaseNS;
        const totalTonase = Math.round((tonaseDS + tonaseNS) * 10) / 10;
        grandTotalTonaseDS += tonaseDS;
        grandTotalRitaseDS += ritaseDS;
        grandTotalTonaseNS += tonaseNS;
        grandTotalRitaseNS += ritaseNS;
        daysMap[dStr] = {
            date: dStr,
            day: dateNum,
            dayName,
            displayDate,
            tonaseDS,
            ritaseDS,
            tonaseNS,
            ritaseNS,
            totalTonase,
            totalRitase,
            avgPayloadDS: Math.round((tonaseDS / ritaseDS) * 10) / 10,
            avgPayloadNS: Math.round((tonaseNS / ritaseNS) * 10) / 10,
            avgPayloadTotal: Math.round((totalTonase / totalRitase) * 10) / 10,
        };
        curDt.setDate(curDt.getDate() + 1);
    }
    const dailyList = Object.values(daysMap).sort((a, b) => a.date.localeCompare(b.date));
    const grandTotalTonase = Math.round((grandTotalTonaseDS + grandTotalTonaseNS) * 10) / 10;
    const grandTotalRitase = grandTotalRitaseDS + grandTotalRitaseNS;
    const activeDays = dailyList.length || 1;
    return {
        period: {
            start_date: startDate,
            end_date: endDate,
            total_days: dailyList.length,
            active_days: activeDays,
        },
        summary: {
            totalTonaseDS: Math.round(grandTotalTonaseDS * 10) / 10,
            totalRitaseDS: grandTotalRitaseDS,
            totalTonaseNS: Math.round(grandTotalTonaseNS * 10) / 10,
            totalRitaseNS: grandTotalRitaseNS,
            grandTotalTonase,
            grandTotalRitase,
            avgTonasePerDay: Math.round((grandTotalTonase / activeDays) * 10) / 10,
            avgPayloadOverall: Math.round((grandTotalTonase / grandTotalRitase) * 10) / 10,
        },
        data: dailyList,
    };
}
/**
 * Generate high-fidelity sample data matching AssetFindr PDF schema
 * Used when token is not yet configured or for simulation mode.
 */
function generateDemoTickets(pageNo = 1, pageSize = 10, search = "") {
    const allDemoTickets = [
        {
            id: "wbt_1001-e89b-12d3-a456-426614174001",
            reference_id: "WB-2026-00101",
            vehicle_asset_id: "ass_987f6543-a21b-43cd-91ef-123456789001",
            vehicle_reference_number: "DT-01",
            vehicle_serial_number: "SN-DT-01-2024",
            vehicle_name: "Dump Truck DT-01",
            inbound_at: "2026-10-30T07:15:20+07:00",
            inbound_weight_kg: 318500,
            inbound_weight_bridge_location_id: "loc_wb_mph_01",
            inbound_weight_bridge_location_label: "Weight Bridge Muara Pahu 01",
            inbound_weight_bridge_location_alias: "WB-MPH-1",
            inbound_operator_user_id: "op_1001",
            inbound_operator_user_first_name: "Budi",
            inbound_operator_user_last_name: "Santoso",
            inbound_operator_user_full_name: "Budi Santoso",
            inbound_operator_user_phone_number: "081234567801",
            inbound_location_id: "loc_pit_alpha",
            inbound_location_label: "Pit Tabang Alpha",
            inbound_location_alias: "PIT-A",
            outbound_at: "2026-10-30T07:58:12+07:00",
            outbound_weight_kg: 104200,
            outbound_weight_bridge_location_id: "loc_wb_port_01",
            outbound_weight_bridge_location_label: "Weight Bridge Port Muara Pahu",
            outbound_weight_bridge_location_alias: "WB-MPH-PORT",
            outbound_operator_user_id: "op_1002",
            outbound_operator_user_first_name: "Agus",
            outbound_operator_user_last_name: "Prasetyo",
            outbound_operator_user_full_name: "Agus Prasetyo",
            outbound_operator_user_phone_number: "081234567802",
            outbound_location_id: "loc_port_mph",
            outbound_location_label: "Stockpile Port Muara Pahu",
            outbound_location_alias: "PORT-MPH",
            net_weight: 214300,
            work_shift_id: "wsf_shift_ds",
            work_shift_alias: "DS",
            work_shift_name: "Day Shift",
            location_route_id: "lro_tabang_mph",
            location_route: {
                id: "lro_tabang_mph",
                start_location_id: "loc_pit_alpha",
                start_location_name: "Pit Tabang Alpha",
                end_location_id: "loc_port_mph",
                end_location_name: "Stockpile Port Muara Pahu",
                operation_start_date: "2025-01-01T00:00:00+07:00",
                distance_km: 68.0,
                is_estimation_distance_km: false,
                is_latest_combination: true,
            },
            material_id: "mat_coal_thermal",
            material: {
                id: "mat_coal_thermal",
                name: "Thermal Coal (GAR 4200)",
                description: "Batu bara termal kualitas GAR 4200",
                status_code: "ACTIVE",
            },
            remark: "Muatan normal, terpal rapi",
            ticket_date: "2026-10-30T07:58:12+07:00",
            reconciliation_date: "2026-10-30T00:00:00Z",
            reconciliation_time_display: "07:58:12 UTC+07",
            created_at: "2026-10-30T08:00:00+07:00",
            created_by_full_name: "Agus Prasetyo",
        },
        {
            id: "wbt_1002-e89b-12d3-a456-426614174002",
            reference_id: "WB-2026-00102",
            vehicle_asset_id: "ass_987f6543-a21b-43cd-91ef-123456789002",
            vehicle_reference_number: "DT-02",
            vehicle_serial_number: "SN-DT-02-2024",
            vehicle_name: "Dump Truck DT-02",
            inbound_at: "2026-10-30T08:10:00+07:00",
            inbound_weight_kg: 322000,
            inbound_weight_bridge_location_id: "loc_wb_mph_01",
            inbound_weight_bridge_location_label: "Weight Bridge Muara Pahu 01",
            inbound_weight_bridge_location_alias: "WB-MPH-1",
            inbound_operator_user_id: "op_1001",
            inbound_operator_user_full_name: "Budi Santoso",
            inbound_location_id: "loc_pit_alpha",
            inbound_location_label: "Pit Tabang Alpha",
            inbound_location_alias: "PIT-A",
            outbound_at: "2026-10-30T08:52:45+07:00",
            outbound_weight_kg: 105000,
            outbound_weight_bridge_location_id: "loc_wb_port_01",
            outbound_weight_bridge_location_label: "Weight Bridge Port Muara Pahu",
            outbound_weight_bridge_location_alias: "WB-MPH-PORT",
            outbound_operator_user_id: "op_1002",
            outbound_operator_user_full_name: "Agus Prasetyo",
            outbound_location_id: "loc_port_mph",
            outbound_location_label: "Stockpile Port Muara Pahu",
            outbound_location_alias: "PORT-MPH",
            net_weight: 217000,
            work_shift_id: "wsf_shift_ds",
            work_shift_alias: "DS",
            work_shift_name: "Day Shift",
            location_route_id: "lro_tabang_mph",
            location_route: {
                id: "lro_tabang_mph",
                start_location_id: "loc_pit_alpha",
                start_location_name: "Pit Tabang Alpha",
                end_location_id: "loc_port_mph",
                end_location_name: "Stockpile Port Muara Pahu",
                distance_km: 68.0,
            },
            material_id: "mat_coal_thermal",
            material: {
                id: "mat_coal_thermal",
                name: "Thermal Coal (GAR 4200)",
                status_code: "ACTIVE",
            },
            remark: "Muatan optimal",
            ticket_date: "2026-10-30T08:52:45+07:00",
            created_at: "2026-10-30T08:55:00+07:00",
            created_by_full_name: "Agus Prasetyo",
        },
        {
            id: "wbt_1003-e89b-12d3-a456-426614174003",
            reference_id: "WB-2026-00103",
            vehicle_asset_id: "ass_987f6543-a21b-43cd-91ef-123456789003",
            vehicle_reference_number: "DT-03",
            vehicle_serial_number: "SN-DT-03-2024",
            vehicle_name: "Dump Truck DT-03",
            inbound_at: "2026-10-30T09:05:15+07:00",
            inbound_weight_kg: 311000,
            inbound_weight_bridge_location_id: "loc_wb_mph_01",
            inbound_weight_bridge_location_label: "Weight Bridge Muara Pahu 01",
            inbound_operator_user_full_name: "Budi Santoso",
            inbound_location_label: "Pit Tabang Bravo",
            outbound_at: "2026-10-30T09:50:30+07:00",
            outbound_weight_kg: 104500,
            outbound_weight_bridge_location_id: "loc_wb_port_01",
            outbound_weight_bridge_location_label: "Weight Bridge Port Muara Pahu",
            outbound_operator_user_full_name: "Agus Prasetyo",
            outbound_location_label: "Stockpile Port Muara Pahu",
            net_weight: 206500,
            work_shift_id: "wsf_shift_ds",
            work_shift_alias: "DS",
            work_shift_name: "Day Shift",
            location_route: {
                id: "lro_tabang_b_mph",
                start_location_name: "Pit Tabang Bravo",
                end_location_name: "Stockpile Port Muara Pahu",
                distance_km: 72.5,
            },
            material: {
                id: "mat_coal_thermal",
                name: "Thermal Coal (GAR 4200)",
                status_code: "ACTIVE",
            },
            remark: "Kondisi lancar",
            ticket_date: "2026-10-30T09:50:30+07:00",
            created_at: "2026-10-30T09:52:00+07:00",
            created_by_full_name: "Agus Prasetyo",
        },
        {
            id: "wbt_1004-e89b-12d3-a456-426614174004",
            reference_id: "WB-2026-00104",
            vehicle_asset_id: "ass_987f6543-a21b-43cd-91ef-123456789004",
            vehicle_reference_number: "DT-05",
            vehicle_name: "Dump Truck DT-05",
            inbound_at: "2026-10-30T10:20:10+07:00",
            inbound_weight_kg: 325400,
            inbound_weight_bridge_location_label: "Weight Bridge Muara Pahu 01",
            inbound_operator_user_full_name: "Budi Santoso",
            inbound_location_label: "Pit Tabang Alpha",
            outbound_at: "2026-10-30T11:05:00+07:00",
            outbound_weight_kg: 106200,
            outbound_weight_bridge_location_label: "Weight Bridge Port Muara Pahu",
            outbound_operator_user_full_name: "Agus Prasetyo",
            outbound_location_label: "Stockpile Port Muara Pahu",
            net_weight: 219200,
            work_shift_id: "wsf_shift_ds",
            work_shift_alias: "DS",
            work_shift_name: "Day Shift",
            location_route: {
                id: "lro_tabang_mph",
                start_location_name: "Pit Tabang Alpha",
                end_location_name: "Stockpile Port Muara Pahu",
                distance_km: 68.0,
            },
            material: {
                id: "mat_coal_coking",
                name: "Coking Coal (GAR 5500)",
                status_code: "ACTIVE",
            },
            remark: "Muatan maksimal",
            ticket_date: "2026-10-30T11:05:00+07:00",
            created_at: "2026-10-30T11:08:00+07:00",
            created_by_full_name: "Agus Prasetyo",
        },
        {
            id: "wbt_1005-e89b-12d3-a456-426614174005",
            reference_id: "WB-2026-00105",
            vehicle_asset_id: "ass_987f6543-a21b-43cd-91ef-123456789005",
            vehicle_reference_number: "DT-08",
            vehicle_name: "Dump Truck DT-08",
            inbound_at: "2026-10-30T11:45:00+07:00",
            inbound_weight_kg: 316800,
            inbound_weight_bridge_location_label: "Weight Bridge Muara Pahu 01",
            inbound_operator_user_full_name: "Budi Santoso",
            inbound_location_label: "Pit Tabang Alpha",
            outbound_at: "2026-10-30T12:30:15+07:00",
            outbound_weight_kg: 104800,
            outbound_weight_bridge_location_label: "Weight Bridge Port Muara Pahu",
            outbound_operator_user_full_name: "Agus Prasetyo",
            outbound_location_label: "Stockpile Port Muara Pahu",
            net_weight: 212000,
            work_shift_id: "wsf_shift_ds",
            work_shift_alias: "DS",
            work_shift_name: "Day Shift",
            location_route: {
                id: "lro_tabang_mph",
                start_location_name: "Pit Tabang Alpha",
                end_location_name: "Stockpile Port Muara Pahu",
                distance_km: 68.0,
            },
            material: {
                id: "mat_coal_thermal",
                name: "Thermal Coal (GAR 4200)",
                status_code: "ACTIVE",
            },
            remark: "Pemeriksaan tara sesuai",
            ticket_date: "2026-10-30T12:30:15+07:00",
            created_at: "2026-10-30T12:35:00+07:00",
            created_by_full_name: "Agus Prasetyo",
        },
        {
            id: "wbt_1006-e89b-12d3-a456-426614174006",
            reference_id: "WB-2026-00095",
            vehicle_asset_id: "ass_987f6543-a21b-43cd-91ef-123456789006",
            vehicle_reference_number: "DT-11",
            vehicle_name: "Dump Truck DT-11",
            inbound_at: "2026-10-29T21:10:00+07:00",
            inbound_weight_kg: 319200,
            inbound_weight_bridge_location_label: "Weight Bridge Muara Pahu 02",
            inbound_operator_user_full_name: "Dani Firmansyah",
            inbound_location_label: "Pit Tabang Alpha",
            outbound_at: "2026-10-29T21:55:00+07:00",
            outbound_weight_kg: 105100,
            outbound_weight_bridge_location_label: "Weight Bridge Port Muara Pahu",
            outbound_operator_user_full_name: "Hendra Gunawan",
            outbound_location_label: "Stockpile Port Muara Pahu",
            net_weight: 214100,
            work_shift_id: "wsf_shift_ns",
            work_shift_alias: "NS",
            work_shift_name: "Night Shift",
            location_route: {
                id: "lro_tabang_mph",
                start_location_name: "Pit Tabang Alpha",
                end_location_name: "Stockpile Port Muara Pahu",
                distance_km: 68.0,
            },
            material: {
                id: "mat_coal_thermal",
                name: "Thermal Coal (GAR 4200)",
                status_code: "ACTIVE",
            },
            remark: "Night hauling aman",
            ticket_date: "2026-10-29T21:55:00+07:00",
            created_at: "2026-10-29T22:00:00+07:00",
            created_by_full_name: "Hendra Gunawan",
        },
        {
            id: "wbt_1007-e89b-12d3-a456-426614174007",
            reference_id: "WB-2026-00096",
            vehicle_asset_id: "ass_987f6543-a21b-43cd-91ef-123456789007",
            vehicle_reference_number: "DT-14",
            vehicle_name: "Dump Truck DT-14",
            inbound_at: "2026-10-29T22:30:00+07:00",
            inbound_weight_kg: 324100,
            inbound_weight_bridge_location_label: "Weight Bridge Muara Pahu 02",
            inbound_operator_user_full_name: "Dani Firmansyah",
            inbound_location_label: "Pit Tabang Alpha",
            outbound_at: "2026-10-29T23:18:20+07:00",
            outbound_weight_kg: 105900,
            outbound_weight_bridge_location_label: "Weight Bridge Port Muara Pahu",
            outbound_operator_user_full_name: "Hendra Gunawan",
            outbound_location_label: "Stockpile Port Muara Pahu",
            net_weight: 218200,
            work_shift_id: "wsf_shift_ns",
            work_shift_alias: "NS",
            work_shift_name: "Night Shift",
            location_route: {
                id: "lro_tabang_mph",
                start_location_name: "Pit Tabang Alpha",
                end_location_name: "Stockpile Port Muara Pahu",
                distance_km: 68.0,
            },
            material: {
                id: "mat_coal_thermal",
                name: "Thermal Coal (GAR 4200)",
                status_code: "ACTIVE",
            },
            remark: "Lampu penerangan normal",
            ticket_date: "2026-10-29T23:18:20+07:00",
            created_at: "2026-10-29T23:20:00+07:00",
            created_by_full_name: "Hendra Gunawan",
        },
        {
            id: "wbt_1008-e89b-12d3-a456-426614174008",
            reference_id: "WB-2026-00097",
            vehicle_asset_id: "ass_987f6543-a21b-43cd-91ef-123456789008",
            vehicle_reference_number: "DT-18",
            vehicle_name: "Dump Truck DT-18",
            inbound_at: "2026-10-30T00:15:00+07:00",
            inbound_weight_kg: 314500,
            inbound_weight_bridge_location_label: "Weight Bridge Muara Pahu 02",
            inbound_operator_user_full_name: "Dani Firmansyah",
            inbound_location_label: "Pit Tabang Alpha",
            outbound_at: "2026-10-30T01:02:40+07:00",
            outbound_weight_kg: 104900,
            outbound_weight_bridge_location_label: "Weight Bridge Port Muara Pahu",
            outbound_operator_user_full_name: "Hendra Gunawan",
            outbound_location_label: "Stockpile Port Muara Pahu",
            net_weight: 209600,
            work_shift_id: "wsf_shift_ns",
            work_shift_alias: "NS",
            work_shift_name: "Night Shift",
            location_route: {
                id: "lro_tabang_mph",
                start_location_name: "Pit Tabang Alpha",
                end_location_name: "Stockpile Port Muara Pahu",
                distance_km: 68.0,
            },
            material: {
                id: "mat_coal_thermal",
                name: "Thermal Coal (GAR 4200)",
                status_code: "ACTIVE",
            },
            remark: "Normal",
            ticket_date: "2026-10-30T01:02:40+07:00",
            created_at: "2026-10-30T01:05:00+07:00",
            created_by_full_name: "Hendra Gunawan",
        },
        {
            id: "wbt_1009-e89b-12d3-a456-426614174009",
            reference_id: "WB-2026-00098",
            vehicle_asset_id: "ass_987f6543-a21b-43cd-91ef-123456789009",
            vehicle_reference_number: "DT-21",
            vehicle_name: "Dump Truck DT-21",
            inbound_at: "2026-10-30T02:05:00+07:00",
            inbound_weight_kg: 326700,
            inbound_weight_bridge_location_label: "Weight Bridge Muara Pahu 02",
            inbound_operator_user_full_name: "Dani Firmansyah",
            inbound_location_label: "Pit Tabang Alpha",
            outbound_at: "2026-10-30T02:50:10+07:00",
            outbound_weight_kg: 106500,
            outbound_weight_bridge_location_label: "Weight Bridge Port Muara Pahu",
            outbound_operator_user_full_name: "Hendra Gunawan",
            outbound_location_label: "Stockpile Port Muara Pahu",
            net_weight: 220200,
            work_shift_id: "wsf_shift_ns",
            work_shift_alias: "NS",
            work_shift_name: "Night Shift",
            location_route: {
                id: "lro_tabang_mph",
                start_location_name: "Pit Tabang Alpha",
                end_location_name: "Stockpile Port Muara Pahu",
                distance_km: 68.0,
            },
            material: {
                id: "mat_coal_coking",
                name: "Coking Coal (GAR 5500)",
                status_code: "ACTIVE",
            },
            remark: "Muatan optimal",
            ticket_date: "2026-10-30T02:50:10+07:00",
            created_at: "2026-10-30T02:55:00+07:00",
            created_by_full_name: "Hendra Gunawan",
        },
        {
            id: "wbt_1010-e89b-12d3-a456-426614174010",
            reference_id: "WB-2026-00099",
            vehicle_asset_id: "ass_987f6543-a21b-43cd-91ef-123456789010",
            vehicle_reference_number: "DT-25",
            vehicle_name: "Dump Truck DT-25",
            inbound_at: "2026-10-30T04:20:00+07:00",
            inbound_weight_kg: 317400,
            inbound_weight_bridge_location_label: "Weight Bridge Muara Pahu 02",
            inbound_operator_user_full_name: "Dani Firmansyah",
            inbound_location_label: "Pit Tabang Alpha",
            outbound_at: "2026-10-30T05:08:30+07:00",
            outbound_weight_kg: 105200,
            outbound_weight_bridge_location_label: "Weight Bridge Port Muara Pahu",
            outbound_operator_user_full_name: "Hendra Gunawan",
            outbound_location_label: "Stockpile Port Muara Pahu",
            net_weight: 212200,
            work_shift_id: "wsf_shift_ns",
            work_shift_alias: "NS",
            work_shift_name: "Night Shift",
            location_route: {
                id: "lro_tabang_mph",
                start_location_name: "Pit Tabang Alpha",
                end_location_name: "Stockpile Port Muara Pahu",
                distance_km: 68.0,
            },
            material: {
                id: "mat_coal_thermal",
                name: "Thermal Coal (GAR 4200)",
                status_code: "ACTIVE",
            },
            remark: "Aman",
            ticket_date: "2026-10-30T05:08:30+07:00",
            created_at: "2026-10-30T05:12:00+07:00",
            created_by_full_name: "Hendra Gunawan",
        },
    ];
    let filtered = allDemoTickets;
    if (search && search.trim()) {
        const q = search.toLowerCase();
        filtered = allDemoTickets.filter((t) => t.reference_id.toLowerCase().includes(q) ||
            (t.vehicle_name && t.vehicle_name.toLowerCase().includes(q)) ||
            (t.vehicle_reference_number && t.vehicle_reference_number.toLowerCase().includes(q)) ||
            (t.inbound_operator_user_full_name && t.inbound_operator_user_full_name.toLowerCase().includes(q)) ||
            (t.outbound_operator_user_full_name && t.outbound_operator_user_full_name.toLowerCase().includes(q)));
    }
    const startIdx = (pageNo - 1) * pageSize;
    const paginated = filtered.slice(startIdx, startIdx + pageSize);
    return {
        total_records: filtered.length,
        page_size: pageSize,
        page_no: pageNo,
        data: paginated,
    };
}
exports.assetfindrController = {
    /**
     * Get WeighBridge Tickets from AssetFindr API
     * Endpoint: GET /api/assetfindr/tickets
     */
    async getTickets(req, res) {
        try {
            const clientId = req.query.client_id || DEFAULT_CLIENT_ID;
            const pageNo = parseInt(req.query.page_no, 10) || 1;
            const pageSize = parseInt(req.query.page_size, 10) || 10;
            const searchKeyword = req.query.search_keyword || "";
            const ticketDateStart = req.query.ticket_date_start || "";
            const ticketDateEnd = req.query.ticket_date_end || "";
            const reconciliationDateStart = req.query.reconciliation_date_start || "";
            const reconciliationDateEnd = req.query.reconciliation_date_end || "";
            // Extract token from request headers or env
            let token = req.headers["x-assetfindr-token"] ||
                req.headers["authorization"] ||
                process.env.ASSETFINDR_BEARER_TOKEN ||
                "";
            if (token.startsWith("Bearer ")) {
                token = token.slice(7).trim();
            }
            // If token is missing, return demo simulation data
            if (!token) {
                const demo = generateDemoTickets(pageNo, pageSize, searchKeyword);
                return res.json({
                    success: true,
                    isLive: false,
                    isDemo: true,
                    message: "Mode Simulasi: Token AssetFindr belum dikonfigurasi. Masukkan Bearer token atau login melalui batara.assetfindr.com untuk data langsung.",
                    total_records: demo.total_records,
                    page_size: demo.page_size,
                    page_no: demo.page_no,
                    data: demo.data,
                });
            }
            // Build target URL - primary endpoint is /v1/weight-bridge-tickets
            const primaryUrl = new URL(`${ASSETFINDR_BASE_URL}/v1/weight-bridge-tickets`);
            primaryUrl.searchParams.set("page_no", String(pageNo));
            primaryUrl.searchParams.set("page_size", String(pageSize));
            if (searchKeyword)
                primaryUrl.searchParams.set("search_keyword", searchKeyword);
            const formattedStartDate = formatToISO(ticketDateStart, "start");
            if (formattedStartDate)
                primaryUrl.searchParams.set("ticket_date_start", formattedStartDate);
            const formattedEndDate = formatToISO(ticketDateEnd, "end");
            if (formattedEndDate)
                primaryUrl.searchParams.set("ticket_date_end", formattedEndDate);
            const formattedReconStart = formatToISO(reconciliationDateStart, "start");
            if (formattedReconStart)
                primaryUrl.searchParams.set("reconciliation_date_start", formattedReconStart);
            const formattedReconEnd = formatToISO(reconciliationDateEnd, "end");
            if (formattedReconEnd)
                primaryUrl.searchParams.set("reconciliation_date_end", formattedReconEnd);
            const sortBy = req.query.sort_by || "inbound_at";
            const sortDirection = req.query.sort_direction || "DESC";
            primaryUrl.searchParams.set("sort_by", sortBy);
            primaryUrl.searchParams.set("sort_direction", sortDirection);
            // Call AssetFindr API
            let apiResponse = await fetch(primaryUrl.toString(), {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                },
            });
            // If /v1/weight-bridge-tickets returns 404, fallback to /client/${clientId}/weight-bridge/tickets
            if (apiResponse.status === 404) {
                const fallbackUrl = new URL(`${ASSETFINDR_BASE_URL}/client/${clientId}/weight-bridge/tickets`);
                fallbackUrl.searchParams.set("page_no", String(pageNo));
                fallbackUrl.searchParams.set("page_size", String(pageSize));
                if (searchKeyword)
                    fallbackUrl.searchParams.set("search_keyword", searchKeyword);
                apiResponse = await fetch(fallbackUrl.toString(), {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                    },
                });
            }
            if (!apiResponse.ok) {
                const errorText = await apiResponse.text();
                console.error("AssetFindr API error:", apiResponse.status, errorText);
                if (apiResponse.status === 401) {
                    return res.status(401).json({
                        success: false,
                        isLive: false,
                        error: "401 Unauthorized: Token AssetFindr tidak valid atau sudah kedaluwarsa. Silakan perbarui login atau token Anda.",
                        status: 401,
                    });
                }
                return res.status(apiResponse.status).json({
                    success: false,
                    isLive: false,
                    error: `AssetFindr API error (${apiResponse.status}): ${errorText}`,
                    status: apiResponse.status,
                });
            }
            const responseData = await apiResponse.json();
            let ticketsData = responseData.data || [];
            const jobsite = req.query.jobsite?.toLowerCase() || "all";
            if (jobsite !== "all") {
                ticketsData = ticketsData.filter((t) => matchesJobsite(t, jobsite));
            }
            return res.json({
                success: true,
                isLive: true,
                isDemo: false,
                total_records: jobsite !== "all"
                    ? ticketsData.length
                    : responseData.total_records ?? ticketsData.length,
                page_size: responseData.page_size ?? pageSize,
                page_no: responseData.page_no ?? pageNo,
                data: ticketsData,
            });
        }
        catch (error) {
            console.error("Error fetching AssetFindr tickets:", error);
            return res.status(500).json({
                success: false,
                isLive: false,
                error: error.message || "Internal server error saat menghubungi AssetFindr API",
            });
        }
    },
    /**
     * Test Connection with AssetFindr API using provided token
     * Endpoint: POST /api/assetfindr/test-connection
     */
    async testConnection(req, res) {
        try {
            let token = req.body?.token ||
                req.headers["x-assetfindr-token"] ||
                req.headers["authorization"] ||
                process.env.ASSETFINDR_BEARER_TOKEN ||
                "";
            if (token.startsWith("Bearer ")) {
                token = token.slice(7).trim();
            }
            const clientId = req.body?.client_id || DEFAULT_CLIENT_ID;
            if (!token) {
                return res.status(400).json({
                    success: false,
                    message: "Token tidak boleh kosong. Masukkan token AssetFindr.",
                });
            }
            // Try primary endpoint first
            let testUrl = `${ASSETFINDR_BASE_URL}/v1/weight-bridge-tickets?page_no=1&page_size=1`;
            let response = await fetch(testUrl, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                },
            });
            // If 404, fallback to client-specific endpoint
            if (response.status === 404) {
                testUrl = `${ASSETFINDR_BASE_URL}/client/${clientId}/weight-bridge/tickets?page_no=1&page_size=1`;
                response = await fetch(testUrl, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                    },
                });
            }
            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 401) {
                    return res.status(401).json({
                        success: false,
                        message: "Koneksi gagal: Token tidak valid atau tidak memiliki izin akses (401 Unauthorized).",
                    });
                }
                return res.status(response.status).json({
                    success: false,
                    message: `Koneksi gagal (HTTP ${response.status}): ${errorText}`,
                });
            }
            const data = await response.json();
            return res.json({
                success: true,
                message: "Koneksi berhasil! Terhubung dengan API AssetFindr Batara.",
                total_records: data.total_records ?? 0,
            });
        }
        catch (error) {
            console.error("Error testing AssetFindr connection:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal menguji koneksi: " + (error.message || "Network error"),
            });
        }
    },
    /**
     * Authenticate directly with AssetFindr (Firebase + API Login)
     * Endpoint: POST /api/assetfindr/login
     */
    async login(req, res) {
        try {
            const email = req.body?.email || "dzaky.athariqf@bataramining.com";
            const password = req.body?.password;
            const clientAlias = req.body?.client_alias || "batara";
            if (!password) {
                return res.status(400).json({
                    success: false,
                    error: "Password wajib diisi.",
                });
            }
            // Step 1: Firebase Auth
            const fbRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${ASSETFINDR_FIREBASE_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, returnSecureToken: true }),
            });
            const fbData = await fbRes.json();
            if (!fbRes.ok || !fbData.idToken) {
                return res.status(401).json({
                    success: false,
                    error: fbData.error?.message || "Login Firebase gagal. Periksa kembali email atau password Anda.",
                });
            }
            // Step 2: AssetFindr /v1/login exchange
            const loginRes = await fetch(`${ASSETFINDR_BASE_URL}/v1/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_firebase_token: fbData.idToken,
                    client_alias: clientAlias,
                    device_type_ref: "WEB_DESKTOP",
                }),
            });
            const loginData = await loginRes.json();
            if (!loginRes.ok || !loginData.jwtToken) {
                return res.status(401).json({
                    success: false,
                    error: loginData.error || loginData.message || "Pertukaran token AssetFindr gagal.",
                });
            }
            return res.json({
                success: true,
                message: "Login berhasil! Token AssetFindr diperoleh.",
                token: loginData.jwtToken,
                user: loginData.user,
                logged_in_client_id: loginData.logged_in_client_id,
            });
        }
        catch (error) {
            console.error("Error logging in to AssetFindr:", error);
            return res.status(500).json({
                success: false,
                error: error.message || "Internal server error saat login ke AssetFindr",
            });
        }
    },
    /**
     * Get Aggregated Daily Production (Day 01 to Today by Shift DS & NS)
     * Endpoint: GET /api/assetfindr/daily-production
     */
    async getDailyProduction(req, res) {
        try {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
            const currentDate = String(now.getDate()).padStart(2, "0");
            const defaultStart = `${currentYear}-${currentMonth}-01`;
            const defaultEnd = `${currentYear}-${currentMonth}-${currentDate}`;
            const startDate = req.query.start_date || defaultStart;
            const endDate = req.query.end_date || defaultEnd;
            const jobsite = req.query.jobsite?.toLowerCase() || "all";
            let token = req.headers["x-assetfindr-token"] ||
                req.headers["authorization"] ||
                process.env.ASSETFINDR_BEARER_TOKEN ||
                "";
            if (token.startsWith("Bearer ")) {
                token = token.slice(7).trim();
            }
            // Check in-memory cache
            const cacheKey = `${token.slice(-12)}_${startDate}_${endDate}_${jobsite}`;
            const cached = dailyProductionCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
                return res.json({ ...cached.data, isCached: true });
            }
            // If token is missing, return high-fidelity simulation
            if (!token) {
                const simData = generateDemoDailyProduction(startDate, endDate, jobsite);
                return res.json({
                    success: true,
                    isLive: false,
                    isDemo: true,
                    jobsite,
                    ...simData,
                });
            }
            // Fetch page 1
            const page1Url = new URL(`${ASSETFINDR_BASE_URL}/v1/weight-bridge-tickets`);
            page1Url.searchParams.set("page_no", "1");
            page1Url.searchParams.set("page_size", "200");
            page1Url.searchParams.set("ticket_date_start", `${startDate}T00:00:00+07:00`);
            page1Url.searchParams.set("ticket_date_end", `${endDate}T23:59:59+07:00`);
            page1Url.searchParams.set("sort_by", "inbound_at");
            page1Url.searchParams.set("sort_direction", "DESC");
            const page1Res = await fetch(page1Url.toString(), {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                },
            });
            if (!page1Res.ok) {
                const errorText = await page1Res.text();
                return res.status(page1Res.status).json({
                    success: false,
                    error: `AssetFindr API error (${page1Res.status}): ${errorText}`,
                });
            }
            const page1Data = await page1Res.json();
            const totalRecords = page1Data.total_records || 0;
            const totalPages = Math.min(Math.ceil(totalRecords / 200), 25); // cap at 25 pages = 5,000 records
            // Fetch remaining pages in parallel
            const remainingPromises = [];
            for (let p = 2; p <= totalPages; p++) {
                const pUrl = new URL(`${ASSETFINDR_BASE_URL}/v1/weight-bridge-tickets`);
                pUrl.searchParams.set("page_no", String(p));
                pUrl.searchParams.set("page_size", "200");
                pUrl.searchParams.set("ticket_date_start", `${startDate}T00:00:00+07:00`);
                pUrl.searchParams.set("ticket_date_end", `${endDate}T23:59:59+07:00`);
                pUrl.searchParams.set("sort_by", "inbound_at");
                pUrl.searchParams.set("sort_direction", "DESC");
                remainingPromises.push(fetch(pUrl.toString(), {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                    },
                })
                    .then((r) => r.json())
                    .catch(() => ({ data: [] })));
            }
            const otherPages = await Promise.all(remainingPromises);
            const allTickets = [
                ...(page1Data.data || []),
                ...otherPages.flatMap((p) => p.data || []),
            ];
            // Prepare date array from startDate to endDate
            const daysMap = {};
            const startDt = new Date(startDate);
            const endDt = new Date(endDate);
            const curDt = new Date(startDt);
            while (curDt <= endDt) {
                const dStr = curDt.toISOString().slice(0, 10);
                const dayOfWeek = curDt.getDay();
                const dateNum = curDt.getDate();
                const monthNum = curDt.getMonth();
                const dayName = INDO_DAYS[dayOfWeek];
                const displayDate = `${dayName}, ${String(dateNum).padStart(2, "0")} ${INDO_MONTHS[monthNum]}`;
                daysMap[dStr] = {
                    date: dStr,
                    day: dateNum,
                    dayName,
                    displayDate,
                    tonaseDS: 0,
                    ritaseDS: 0,
                    tonaseNS: 0,
                    ritaseNS: 0,
                    totalTonase: 0,
                    totalRitase: 0,
                    avgPayloadDS: 0,
                    avgPayloadNS: 0,
                    avgPayloadTotal: 0,
                };
                curDt.setDate(curDt.getDate() + 1);
            }
            // Aggregate tickets by date and shift
            allTickets.forEach((t) => {
                if (!matchesJobsite(t, jobsite))
                    return;
                const dStr = (t.ticket_date || t.created_at || "").slice(0, 10);
                if (!daysMap[dStr])
                    return;
                const isNight = t.work_shift_alias === "NS" ||
                    (t.work_shift_name && t.work_shift_name.toLowerCase().includes("night"));
                const netTon = (t.net_weight || 0) / 1000;
                if (isNight) {
                    daysMap[dStr].tonaseNS += netTon;
                    daysMap[dStr].ritaseNS += 1;
                }
                else {
                    daysMap[dStr].tonaseDS += netTon;
                    daysMap[dStr].ritaseDS += 1;
                }
                daysMap[dStr].totalTonase += netTon;
                daysMap[dStr].totalRitase += 1;
            });
            // Format numbers & compute totals
            let grandTotalTonaseDS = 0;
            let grandTotalRitaseDS = 0;
            let grandTotalTonaseNS = 0;
            let grandTotalRitaseNS = 0;
            const dailyList = Object.values(daysMap)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((item) => {
                grandTotalTonaseDS += item.tonaseDS;
                grandTotalRitaseDS += item.ritaseDS;
                grandTotalTonaseNS += item.tonaseNS;
                grandTotalRitaseNS += item.ritaseNS;
                return {
                    ...item,
                    tonaseDS: Math.round(item.tonaseDS * 100) / 100,
                    tonaseNS: Math.round(item.tonaseNS * 100) / 100,
                    totalTonase: Math.round(item.totalTonase * 100) / 100,
                    avgPayloadDS: item.ritaseDS > 0 ? Math.round((item.tonaseDS / item.ritaseDS) * 10) / 10 : 0,
                    avgPayloadNS: item.ritaseNS > 0 ? Math.round((item.tonaseNS / item.ritaseNS) * 10) / 10 : 0,
                    avgPayloadTotal: item.totalRitase > 0 ? Math.round((item.totalTonase / item.totalRitase) * 10) / 10 : 0,
                };
            });
            const grandTotalTonase = Math.round((grandTotalTonaseDS + grandTotalTonaseNS) * 100) / 100;
            const grandTotalRitase = grandTotalRitaseDS + grandTotalRitaseNS;
            const activeDays = dailyList.filter((d) => d.totalRitase > 0).length || 1;
            const responsePayload = {
                success: true,
                isLive: true,
                period: {
                    start_date: startDate,
                    end_date: endDate,
                    total_days: dailyList.length,
                    active_days: activeDays,
                },
                summary: {
                    totalTonaseDS: Math.round(grandTotalTonaseDS * 100) / 100,
                    totalRitaseDS: grandTotalRitaseDS,
                    totalTonaseNS: Math.round(grandTotalTonaseNS * 100) / 100,
                    totalRitaseNS: grandTotalRitaseNS,
                    grandTotalTonase,
                    grandTotalRitase,
                    avgTonasePerDay: Math.round((grandTotalTonase / activeDays) * 100) / 100,
                    avgPayloadOverall: grandTotalRitase > 0 ? Math.round((grandTotalTonase / grandTotalRitase) * 10) / 10 : 0,
                },
                data: dailyList,
            };
            // Cache the result
            dailyProductionCache.set(cacheKey, {
                timestamp: Date.now(),
                data: responsePayload,
            });
            return res.json(responsePayload);
        }
        catch (error) {
            console.error("Error in getDailyProduction:", error);
            return res.status(500).json({
                success: false,
                error: error.message || "Gagal memproses data produksi harian AssetFindr",
            });
        }
    },
};
