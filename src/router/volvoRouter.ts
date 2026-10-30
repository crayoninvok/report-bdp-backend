import { Router } from "express";
import {
  getLiveMonitoringUnits,
  getRawVehicles,
  getRawPositions,
} from "../controller/volvoController";

const router = Router();

// Main Live Monitoring Endpoint (merged vehicles + latest positions + KPI summary)
router.get("/monitoring", getLiveMonitoringUnits);

// Raw endpoints
router.get("/vehicles", getRawVehicles);
router.get("/positions", getRawPositions);

export default router;
