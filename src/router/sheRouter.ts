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
  getObservations,
  createObservation,
  updateObservation,
  deleteObservation,
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

// Safety Observations
router.get("/observations", getObservations);
router.post("/observations", createObservation);
router.put("/observations/:id", updateObservation);
router.delete("/observations/:id", deleteObservation);

export default router;
