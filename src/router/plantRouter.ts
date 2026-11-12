import { Router } from "express";
import { plantController } from "../controller/plantController";
import { pmController } from "../controller/pmController";
import { plantDashboardController } from "../controller/plantDashboardController";

const plantRouter = Router();

// 0. Dashboard Plant Analytics (GL Plant Cost + Preventive Maintenance PI/PS)
plantRouter.get("/dashboard", plantDashboardController.getPlantDashboard);

// 1. Master Units
plantRouter.get("/units", plantController.getMasterUnits);
plantRouter.put("/units/:unitCode", plantController.updateUnit);

// 2. Settings (daily_pi_target, daily_pm_target)
plantRouter.get("/settings", plantController.getPlantSettings);
plantRouter.put("/settings", plantController.updatePlantSetting);

// 3. Weekly Schedule & Daily Items (Periodic Inspection)
plantRouter.get("/periodic-inspection/weekly", plantController.getWeeklySchedule);
plantRouter.post("/periodic-inspection/plan", plantController.upsertDailyPlan);
plantRouter.post("/periodic-inspection/item", plantController.addInspectionItem);
plantRouter.post("/periodic-inspection/bulk-add", plantController.bulkAddInspectionItems);
plantRouter.put("/periodic-inspection/item/:id", plantController.updateInspectionItem);
plantRouter.delete("/periodic-inspection/item/:id", plantController.deleteInspectionItem);
plantRouter.post("/periodic-inspection/apply-standard-template", plantController.applyStandardWeeklySchedule);

// 4. Weekly Schedule, Daily Items & Radar KM/HM (Periodic Service / Preventive Maintenance)
for (const psBase of ["/preventive-maintenance", "/periodic-service"]) {
  plantRouter.get(`${psBase}/weekly`, pmController.getPmWeeklySchedule);
  plantRouter.post(`${psBase}/plan`, pmController.upsertPmDailyPlan);
  plantRouter.post(`${psBase}/item`, pmController.addPmItem);
  plantRouter.post(`${psBase}/bulk-add`, pmController.bulkAddPmItems);
  plantRouter.put(`${psBase}/item/:id`, pmController.updatePmItem);
  plantRouter.delete(`${psBase}/item/:id`, pmController.deletePmItem);
  plantRouter.post(`${psBase}/auto-schedule-due`, pmController.autoScheduleDueUnits);
  plantRouter.get(`${psBase}/radar`, pmController.getPmRadar);
  plantRouter.get(`${psBase}/personnel`, pmController.getPlantPersonnel);
}

// 5. Tyre & Rim Usage (from GL Beban Tyre 05110203)
plantRouter.get("/tyre-rim-usage", plantController.getTyreRimUsage);

export default plantRouter;
