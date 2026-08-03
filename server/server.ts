import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import socialAuthRouter from "./routes/socialAuthRoutes.js";
import accountRouter from "./routes/accountsRoutes.js";
import postRouter from "./routes/postRoutes.js";
import activityRouter from "./routes/activityRoutes.js";
import { initScheduler } from "./services/schedulerService.js";

const app = express();
await connectDB();

// ✅ FIXED: Proper CORS configuration - REMOVE app.options("*", ...)
const corsOptions = {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
  exposedHeaders: ["Authorization"],
};

app.use(cors(corsOptions));
// ❌ REMOVE THIS LINE: app.options("*", cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRouter);
app.use("/api/oauth", socialAuthRouter);
app.use("/api/accounts", accountRouter);
app.use("/api/posts", postRouter);
app.use("/api/activity", activityRouter);

initScheduler();

const port = process.env.PORT || 3000;

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("❌ Error:", err);
  res.status(500).json({
    message:
      err?.response?.data?.message || err?.message || "Internal server error",
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.send("Server is Live!");
});

app.listen(port, () => {
  console.log(`✅ Server is running at http://localhost:${port}`);
  console.log(`📡 API available at http://localhost:${port}/api`);
});
