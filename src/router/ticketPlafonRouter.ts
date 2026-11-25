import { Router } from "express";
import {
  getTicketPlafonList,
  recordTicketUsage,
  getTicketHistory,
  updatePlafonConfig,
  resetPlafonManual,
} from "../controller/ticketPlafonController";

const ticketPlafonRouter = Router();

// GET list & summaries
ticketPlafonRouter.get("/", getTicketPlafonList);

// POST record departure ticket usage
ticketPlafonRouter.post("/usage", recordTicketUsage);

// GET employee ticket history
ticketPlafonRouter.get("/history/:employeeId", getTicketHistory);

// PUT update plafon amount or notes
ticketPlafonRouter.put("/config/:employeeId", updatePlafonConfig);

// POST manual reset
ticketPlafonRouter.post("/reset/:employeeId", resetPlafonManual);

export default ticketPlafonRouter;
