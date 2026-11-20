import { Router } from "express";
import {
  getHazards,
  getDashboard,
  createHazard,
  updateHazard,
  deleteHazard,
} from "../controller/sheController";

const router = Router();

router.get("/hazards", getHazards);
router.get("/dashboard", getDashboard);
router.post("/hazards", createHazard);
router.put("/hazards/:id", updateHazard);
router.delete("/hazards/:id", deleteHazard);

export default router;
