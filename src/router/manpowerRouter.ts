import { Router } from "express";
import {
  syncManpowerFromSheet,
  getManpowerList,
  getManpowerStats,
  getManpowerDashboard,
  getManpowerById,
} from "../controller/manpowerController";

const router = Router();

// Sync from Google Sheet CSV
router.post("/sync", syncManpowerFromSheet);

// Stats & Aggregations
router.get("/stats", getManpowerStats);

// Full Analytics Dashboard (Executive Charts, Tables, Cross-Site Comparison)
router.get("/dashboard", getManpowerDashboard);

// List with pagination and search
router.get("/", getManpowerList);

// Detail of single employee
router.get("/:id", getManpowerById);

export default router;
