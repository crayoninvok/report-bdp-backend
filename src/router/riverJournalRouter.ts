import { Router } from "express";
import {
  getRiverJournals,
  getRiverJournalStats,
  createRiverJournal,
  updateRiverJournal,
  deleteRiverJournal,
} from "../controller/riverJournalController";
import { extractUser } from "../middleware/authMiddleware";

const router = Router();

router.use(extractUser);

router.get("/stats", getRiverJournalStats);
router.get("/", getRiverJournals);
router.post("/", createRiverJournal);
router.put("/:id", updateRiverJournal);
router.delete("/:id", deleteRiverJournal);

export default router;
