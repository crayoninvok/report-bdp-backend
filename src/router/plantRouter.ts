import { Router } from "express";
import { plantController } from "../controller/plantController";
import { pmController } from "../controller/pmController";

const plantRouter = Router();

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

// 4. Weekly Schedule, Daily Items & Radar KM/HM (Preventive Maintenance)
plantRouter.get("/preventive-maintenance/weekly", pmController.getPmWeeklySchedule);
plantRouter.post("/preventive-maintenance/plan", pmController.upsertPmDailyPlan);
plantRouter.post("/preventive-maintenance/item", pmController.addPmItem);
plantRouter.post("/preventive-maintenance/bulk-add", pmController.bulkAddPmItems);
plantRouter.put("/preventive-maintenance/item/:id", pmController.updatePmItem);
plantRouter.delete("/preventive-maintenance/item/:id", pmController.deletePmItem);
plantRouter.post("/preventive-maintenance/auto-schedule-due", pmController.autoScheduleDueUnits);
plantRouter.get("/preventive-maintenance/radar", pmController.getPmRadar);

// 5. Tyre & Rim Usage (from GL Beban Tyre 05110203)
plantRouter.get("/tyre-rim-usage", plantController.getTyreRimUsage);

export default plantRouter;
