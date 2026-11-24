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
// Safety Observations
router.get("/observations", sheController_1.getObservations);
router.post("/observations", sheController_1.createObservation);
router.put("/observations/:id", sheController_1.updateObservation);
router.delete("/observations/:id", sheController_1.deleteObservation);
exports.default = router;
