"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const assetfindrController_1 = require("../controller/assetfindrController");
const router = (0, express_1.Router)();
// GET /api/assetfindr/tickets
router.get("/tickets", assetfindrController_1.assetfindrController.getTickets);
// POST /api/assetfindr/test-connection
router.post("/test-connection", assetfindrController_1.assetfindrController.testConnection);
// POST /api/assetfindr/login
router.post("/login", assetfindrController_1.assetfindrController.login);
exports.default = router;
