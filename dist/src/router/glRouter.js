"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const glController_1 = require("../controller/glController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 40 * 1024 * 1024 }, // 40MB limit for large GL workbooks
});
router.use(authMiddleware_1.extractUser);
router.get("/periods", glController_1.getGLPeriods);
router.get("/summary", glController_1.getGLExpenseSummaries);
router.get("/transactions", glController_1.getGLTransactions);
router.post("/upload/preview", upload.single("file"), glController_1.previewGLUpload);
router.post("/upload/commit", upload.single("file"), glController_1.commitGLUpload);
exports.default = router;
