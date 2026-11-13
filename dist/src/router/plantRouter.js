"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const plantController_1 = require("../controller/plantController");
const pmController_1 = require("../controller/pmController");
const plantDashboardController_1 = require("../controller/plantDashboardController");
const dailyPaController_1 = require("../controller/dailyPaController");
const dailyBreakdownController_1 = require("../controller/dailyBreakdownController");
const plantRouter = (0, express_1.Router)();
// 0. Dashboard Plant Analytics (GL Plant Cost + Preventive Maintenance PI/PS)
plantRouter.get("/dashboard", plantDashboardController_1.plantDashboardController.getPlantDashboard);
// 1. Master Units
plantRouter.get("/units", plantController_1.plantController.getMasterUnits);
plantRouter.post("/units", plantController_1.plantController.createUnit);
plantRouter.post("/units/sync-volvo", plantController_1.plantController.syncVolvoUnits);
plantRouter.put("/units/:unitCode", plantController_1.plantController.updateUnit);
// 2. Settings (daily_pi_target, daily_pm_target)
plantRouter.get("/settings", plantController_1.plantController.getPlantSettings);
plantRouter.put("/settings", plantController_1.plantController.updatePlantSetting);
// 3. Weekly Schedule & Daily Items (Periodic Inspection)
plantRouter.get("/periodic-inspection/weekly", plantController_1.plantController.getWeeklySchedule);
plantRouter.post("/periodic-inspection/plan", plantController_1.plantController.upsertDailyPlan);
plantRouter.post("/periodic-inspection/item", plantController_1.plantController.addInspectionItem);
plantRouter.post("/periodic-inspection/bulk-add", plantController_1.plantController.bulkAddInspectionItems);
plantRouter.put("/periodic-inspection/item/:id", plantController_1.plantController.updateInspectionItem);
plantRouter.delete("/periodic-inspection/item/:id", plantController_1.plantController.deleteInspectionItem);
plantRouter.post("/periodic-inspection/apply-standard-template", plantController_1.plantController.applyStandardWeeklySchedule);
// 4. Weekly Schedule, Daily Items & Radar KM/HM (Periodic Service / Preventive Maintenance)
for (const psBase of ["/preventive-maintenance", "/periodic-service"]) {
    plantRouter.get(`${psBase}/weekly`, pmController_1.pmController.getPmWeeklySchedule);
    plantRouter.post(`${psBase}/plan`, pmController_1.pmController.upsertPmDailyPlan);
    plantRouter.post(`${psBase}/item`, pmController_1.pmController.addPmItem);
    plantRouter.post(`${psBase}/bulk-add`, pmController_1.pmController.bulkAddPmItems);
    plantRouter.put(`${psBase}/item/:id`, pmController_1.pmController.updatePmItem);
    plantRouter.delete(`${psBase}/item/:id`, pmController_1.pmController.deletePmItem);
    plantRouter.post(`${psBase}/auto-schedule-due`, pmController_1.pmController.autoScheduleDueUnits);
    plantRouter.get(`${psBase}/radar`, pmController_1.pmController.getPmRadar);
    plantRouter.get(`${psBase}/personnel`, pmController_1.pmController.getPlantPersonnel);
}
// 5. Tyre & Rim Usage (from GL Beban Tyre 05110203)
plantRouter.get("/tyre-rim-usage", plantController_1.plantController.getTyreRimUsage);
// 6. Daily Physical Availability (Daily PA Report)
plantRouter.get("/daily-pa", dailyPaController_1.dailyPaController.getDailyPaReport);
plantRouter.get("/daily-pa/monthly-summary", dailyPaController_1.dailyPaController.getMonthlyCalendarSummary);
plantRouter.put("/daily-pa/settings", dailyPaController_1.dailyPaController.updateDailyPaSettings);
plantRouter.post("/daily-pa/units", dailyPaController_1.dailyPaController.addUnitsToDailyPa);
plantRouter.delete("/daily-pa/units/:entryId", dailyPaController_1.dailyPaController.removeUnitFromDailyPa);
plantRouter.post("/daily-pa/sync-pi-ps", dailyPaController_1.dailyPaController.syncPiPsToDailyPa);
plantRouter.post("/daily-pa/activities", dailyPaController_1.dailyPaController.addActivity);
plantRouter.put("/daily-pa/activities/:activityId", dailyPaController_1.dailyPaController.updateActivity);
plantRouter.delete("/daily-pa/activities/:activityId", dailyPaController_1.dailyPaController.deleteActivity);
// 7. Daily Breakdown Report
plantRouter.get("/daily-breakdown", dailyBreakdownController_1.dailyBreakdownController.getDailyBreakdownList);
plantRouter.post("/daily-breakdown", dailyBreakdownController_1.dailyBreakdownController.createDailyBreakdown);
plantRouter.put("/daily-breakdown/:id", dailyBreakdownController_1.dailyBreakdownController.updateDailyBreakdown);
plantRouter.delete("/daily-breakdown/:id", dailyBreakdownController_1.dailyBreakdownController.deleteDailyBreakdown);
exports.default = plantRouter;
