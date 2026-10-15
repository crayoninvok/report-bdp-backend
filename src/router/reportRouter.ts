import { Router } from "express";
import multer from "multer";
import {
  getReports,
  getReportDetails,
  createReport,
  updateBudget,
  updateRealisasi,
  getSummaryOps,
  deleteReport,
  previewExcelUpload,
  commitExcelUpload,
} from "../controller/reportController";

import { extractUser } from "../middleware/authMiddleware";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 35 * 1024 * 1024 }, // 35MB
});

router.use(extractUser);

router.get("/", getReports);
router.get("/summary/ops", getSummaryOps);
router.post("/upload/preview", upload.single("file"), previewExcelUpload);
router.post("/upload/commit", upload.single("file"), commitExcelUpload);
router.get("/:id", getReportDetails);
router.post("/", createReport);
router.put("/:id/budget", updateBudget);
router.put("/:id/realisasi", updateRealisasi);
router.delete("/:id", deleteReport);

export default router;
