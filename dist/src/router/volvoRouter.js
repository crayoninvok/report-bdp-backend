"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const volvoController_1 = require("../controller/volvoController");
const router = (0, express_1.Router)();
// Main Live Monitoring Endpoint (merged vehicles + latest positions + KPI summary)
router.get("/monitoring", volvoController_1.getLiveMonitoringUnits);
// Raw endpoints
router.get("/vehicles", volvoController_1.getRawVehicles);
router.get("/positions", volvoController_1.getRawPositions);
exports.default = router;
