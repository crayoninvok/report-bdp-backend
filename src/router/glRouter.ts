import { Router } from "express";
import multer from "multer";
import {
  previewGLUpload,
  commitGLUpload,
  getGLPeriods,
  getGLExpenseSummaries,
  getGLTransactions,
} from "../controller/glController";
import { extractUser } from "../middleware/authMiddleware";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 }, // 40MB limit for large GL workbooks
});

router.use(extractUser);

router.get("/periods", getGLPeriods);
router.get("/summary", getGLExpenseSummaries);
router.get("/transactions", getGLTransactions);
router.post("/upload/preview", upload.single("file"), previewGLUpload);
router.post("/upload/commit", upload.single("file"), commitGLUpload);

export default router;
