"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const manpowerController_1 = require("../controller/manpowerController");
const router = (0, express_1.Router)();
// Sync from Google Sheet CSV
router.post("/sync", manpowerController_1.syncManpowerFromSheet);
// Stats & Aggregations
router.get("/stats", manpowerController_1.getManpowerStats);
// Full Analytics Dashboard (Executive Charts, Tables, Cross-Site Comparison)
router.get("/dashboard", manpowerController_1.getManpowerDashboard);
// List with pagination and search
router.get("/", manpowerController_1.getManpowerList);
// Detail of single employee
router.get("/:id", manpowerController_1.getManpowerById);
exports.default = router;
