import { Router } from "express";
import { assetfindrController } from "../controller/assetfindrController";

const router = Router();

// GET /api/assetfindr/tickets
router.get("/tickets", assetfindrController.getTickets);

// GET /api/assetfindr/daily-production
router.get("/daily-production", assetfindrController.getDailyProduction);

// POST /api/assetfindr/test-connection
router.post("/test-connection", assetfindrController.testConnection);

// POST /api/assetfindr/login
router.post("/login", assetfindrController.login);


export default router;

