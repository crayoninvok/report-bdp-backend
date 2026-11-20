import { Router } from "express";
import {
  getHazards,
  getDashboard,
  createHazard,
  updateHazard,
  deleteHazard,
  getInspections,
  createInspection,
  updateInspection,
  deleteInspection,
} from "../controller/sheController";

const router = Router();

// Hazard Reports
router.get("/hazards", getHazards);
router.get("/dashboard", getDashboard);
router.post("/hazards", createHazard);
router.put("/hazards/:id", updateHazard);
router.delete("/hazards/:id", deleteHazard);

// Work Area Inspections
router.get("/inspections", getInspections);
router.post("/inspections", createInspection);
router.put("/inspections/:id", updateInspection);
router.delete("/inspections/:id", deleteInspection);

export default router;
