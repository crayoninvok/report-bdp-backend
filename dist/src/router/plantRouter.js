"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const plantController_1 = require("../controller/plantController");
const plantRouter = (0, express_1.Router)();
// 1. Master Units
plantRouter.get("/units", plantController_1.plantController.getMasterUnits);
plantRouter.put("/units/:unitCode", plantController_1.plantController.updateUnit);
// 2. Settings (daily_pi_target)
plantRouter.get("/settings", plantController_1.plantController.getPlantSettings);
plantRouter.put("/settings", plantController_1.plantController.updatePlantSetting);
// 3. Weekly Schedule & Daily Items
plantRouter.get("/periodic-inspection/weekly", plantController_1.plantController.getWeeklySchedule);
plantRouter.post("/periodic-inspection/plan", plantController_1.plantController.upsertDailyPlan);
plantRouter.post("/periodic-inspection/item", plantController_1.plantController.addInspectionItem);
plantRouter.post("/periodic-inspection/bulk-add", plantController_1.plantController.bulkAddInspectionItems);
plantRouter.put("/periodic-inspection/item/:id", plantController_1.plantController.updateInspectionItem);
plantRouter.delete("/periodic-inspection/item/:id", plantController_1.plantController.deleteInspectionItem);
plantRouter.post("/periodic-inspection/apply-standard-template", plantController_1.plantController.applyStandardWeeklySchedule);
// 4. Tyre & Rim Usage (from GL Beban Tyre 05110203)
plantRouter.get("/tyre-rim-usage", plantController_1.plantController.getTyreRimUsage);
exports.default = plantRouter;
