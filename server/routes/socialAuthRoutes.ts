import express from "express";
import { protect } from "../middleware/authMiddlerware.js";
import {
  generateAuthUrl,
  syncAccounts,
} from "../controllers/socialAuthController.js";

const socialAuthRouter = express.Router();

// ✅ FIXED: Match the frontend call pattern
socialAuthRouter.get("/:platform/url", protect, generateAuthUrl);
socialAuthRouter.get("/sync", protect, syncAccounts);

export default socialAuthRouter;
