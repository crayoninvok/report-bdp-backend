import { Router } from "express";
import {
  getReports,
  getReportDetails,
  createReport,
  updateBudget,
  updateRealisasi,
  getSummaryOps,
  deleteReport,
} from "../controller/reportController";

import { extractUser } from "../middleware/authMiddleware";

const router = Router();

router.use(extractUser);

router.get("/", getReports);
router.get("/summary/ops", getSummaryOps);
router.get("/:id", getReportDetails);
router.post("/", createReport);
router.put("/:id/budget", updateBudget);
router.put("/:id/realisasi", updateRealisasi);
router.delete("/:id", deleteReport);

export default router;
