"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const productionController_1 = require("../controller/productionController");
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
});
const router = (0, express_1.Router)();
// Stats & Calculations
router.get("/daily/stats", productionController_1.getProductionStats);
router.post("/calculate-ua", productionController_1.calculateUA);
// Excel Sync & Upload
router.post("/daily/sync-bundled-excel", productionController_1.syncBundledExcel);
router.post("/daily/upload-excel", upload.single("file"), productionController_1.uploadExcelProduction);
// CRUD
router.get("/daily", productionController_1.getDailyProductions);
router.post("/daily", productionController_1.createDailyProduction);
router.put("/daily/:id", productionController_1.updateDailyProduction);
router.delete("/daily/:id", productionController_1.deleteDailyProduction);
exports.default = router;
