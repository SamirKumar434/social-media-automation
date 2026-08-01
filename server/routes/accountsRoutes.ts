import express from "express";
import { protect } from "../middleware/authMiddlerware.js";
import {
  addAccount,
  disconnectAccount,
  getAccounts,
} from "../controllers/accountsController.js";

const accountRouter = express.Router();

accountRouter.get("/", protect, getAccounts);
accountRouter.post("/", protect, addAccount);
accountRouter.delete("/:id", protect, disconnectAccount);

export default accountRouter;
