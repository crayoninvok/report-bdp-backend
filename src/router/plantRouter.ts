import { Router } from "express";
import { plantController } from "../controller/plantController";

const plantRouter = Router();

// 1. Master Units
plantRouter.get("/units", plantController.getMasterUnits);
plantRouter.put("/units/:unitCode", plantController.updateUnit);

// 2. Settings (daily_pi_target)
plantRouter.get("/settings", plantController.getPlantSettings);
plantRouter.put("/settings", plantController.updatePlantSetting);

// 3. Weekly Schedule & Daily Items
plantRouter.get("/periodic-inspection/weekly", plantController.getWeeklySchedule);
plantRouter.post("/periodic-inspection/plan", plantController.upsertDailyPlan);
plantRouter.post("/periodic-inspection/item", plantController.addInspectionItem);
plantRouter.post("/periodic-inspection/bulk-add", plantController.bulkAddInspectionItems);
plantRouter.put("/periodic-inspection/item/:id", plantController.updateInspectionItem);
plantRouter.delete("/periodic-inspection/item/:id", plantController.deleteInspectionItem);
plantRouter.post("/periodic-inspection/apply-standard-template", plantController.applyStandardWeeklySchedule);

export default plantRouter;
