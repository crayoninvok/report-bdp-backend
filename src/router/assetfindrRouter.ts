import { Router } from "express";
import { assetfindrController } from "../controller/assetfindrController";

const router = Router();

// GET /api/assetfindr/tickets
router.get("/tickets", assetfindrController.getTickets);

// POST /api/assetfindr/test-connection
router.post("/test-connection", assetfindrController.testConnection);

// POST /api/assetfindr/login
router.post("/login", assetfindrController.login);

export default router;

