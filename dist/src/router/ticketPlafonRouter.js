"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ticketPlafonController_1 = require("../controller/ticketPlafonController");
const ticketPlafonRouter = (0, express_1.Router)();
// GET list & summaries
ticketPlafonRouter.get("/", ticketPlafonController_1.getTicketPlafonList);
// POST record departure ticket usage
ticketPlafonRouter.post("/usage", ticketPlafonController_1.recordTicketUsage);
// GET employee ticket history
ticketPlafonRouter.get("/history/:employeeId", ticketPlafonController_1.getTicketHistory);
// PUT update plafon amount or notes
ticketPlafonRouter.put("/config/:employeeId", ticketPlafonController_1.updatePlafonConfig);
// POST manual reset
ticketPlafonRouter.post("/reset/:employeeId", ticketPlafonController_1.resetPlafonManual);
exports.default = ticketPlafonRouter;
