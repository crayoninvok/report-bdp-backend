"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sheController_1 = require("../controller/sheController");
const router = (0, express_1.Router)();
// Hazard Reports
router.get("/hazards", sheController_1.getHazards);
router.get("/dashboard", sheController_1.getDashboard);
router.post("/hazards", sheController_1.createHazard);
router.put("/hazards/:id", sheController_1.updateHazard);
router.delete("/hazards/:id", sheController_1.deleteHazard);
// Work Area Inspections
router.get("/inspections", sheController_1.getInspections);
router.post("/inspections", sheController_1.createInspection);
router.put("/inspections/:id", sheController_1.updateInspection);
router.delete("/inspections/:id", sheController_1.deleteInspection);
exports.default = router;
