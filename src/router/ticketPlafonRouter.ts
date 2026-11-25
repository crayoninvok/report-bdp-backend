import { Router } from "express";
import {
  getTicketPlafonList,
  getTicketAnalytics,
  recordTicketUsage,
  getTicketHistory,
  updateTicketUsageHistory,
  deleteTicketUsageHistory,
  updatePlafonConfig,
  resetPlafonManual,
} from "../controller/ticketPlafonController";

const ticketPlafonRouter = Router();

// GET list & summaries
ticketPlafonRouter.get("/", getTicketPlafonList);

// GET YTD ticket purchase analytics based on manpower
ticketPlafonRouter.get("/analytics", getTicketAnalytics);

// POST record departure ticket usage
ticketPlafonRouter.post("/usage", recordTicketUsage);

// GET employee ticket history
ticketPlafonRouter.get("/history/:employeeId", getTicketHistory);

// PUT update individual ticket record
ticketPlafonRouter.put("/ticket/:id", updateTicketUsageHistory);

// DELETE individual ticket record
ticketPlafonRouter.delete("/ticket/:id", deleteTicketUsageHistory);

// PUT update plafon amount or notes
ticketPlafonRouter.put("/config/:employeeId", updatePlafonConfig);

// POST manual reset
ticketPlafonRouter.post("/reset/:employeeId", resetPlafonManual);

export default ticketPlafonRouter;
