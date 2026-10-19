import { Router } from "express";
import multer from "multer";
import {
  getDailyProductions,
  getProductionStats,
  createDailyProduction,
  updateDailyProduction,
  deleteDailyProduction,
  syncBundledExcel,
  uploadExcelProduction,
  calculateUA,
} from "../controller/productionController";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
});

const router = Router();

// Stats & Calculations
router.get("/daily/stats", getProductionStats);
router.post("/calculate-ua", calculateUA);

// Excel Sync & Upload
router.post("/daily/sync-bundled-excel", syncBundledExcel);
router.post("/daily/upload-excel", upload.single("file"), uploadExcelProduction);

// CRUD
router.get("/daily", getDailyProductions);
router.post("/daily", createDailyProduction);
router.put("/daily/:id", updateDailyProduction);
router.delete("/daily/:id", deleteDailyProduction);

export default router;
