"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const reportController_1 = require("../controller/reportController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 35 * 1024 * 1024 }, // 35MB
});
router.use(authMiddleware_1.extractUser);
router.get("/", reportController_1.getReports);
router.get("/summary/ops", reportController_1.getSummaryOps);
router.get("/trend", reportController_1.getCostTrends);
router.post("/upload/preview", upload.single("file"), reportController_1.previewExcelUpload);
router.post("/upload/commit", upload.single("file"), reportController_1.commitExcelUpload);
router.get("/:id", reportController_1.getReportDetails);
router.post("/", reportController_1.createReport);
router.put("/:id/period", reportController_1.updatePeriod);
router.put("/:id/budget", reportController_1.updateBudget);
router.put("/:id/realisasi", reportController_1.updateRealisasi);
router.delete("/:id", reportController_1.deleteReport);
exports.default = router;
