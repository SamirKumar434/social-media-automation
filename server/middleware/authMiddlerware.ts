import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export interface AuthRequest extends Request {
  user?: any;
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  let token;

  console.log("🔵 [AUTH] Authorization header:", req.headers.authorization);

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      console.log("🔵 [AUTH] Token received:", token?.substring(0, 20) + "...");

      if (!process.env.JWT_SECRET) {
        console.error("🔴 [AUTH] JWT_SECRET is not defined");
        res.status(500).json({ message: "Server configuration error" });
        return;
      }

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
      console.log("🔵 [AUTH] Decoded token:", { id: decoded.id });

      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        console.log("🔴 [AUTH] User not found for ID:", decoded.id);
        res.status(401).json({ message: "User not found" });
        return;
      }

      // ✅ FIX: Convert Mongoose document to plain object
      const userObject = user.toObject ? user.toObject() : { ...user };

      // ✅ Attach the plain object to request
      req.user = userObject;

      // ✅ Debug: Log the converted user object
      console.log("🔵 [AUTH] User authenticated:", userObject._id);
      console.log("🔵 [AUTH] User email:", userObject.email);
      console.log("🔵 [AUTH] User object type:", typeof req.user);
      console.log("🔵 [AUTH] User object keys:", Object.keys(req.user));
      console.log("🔵 [AUTH] User object converted to plain JS object");

      next();
    } catch (error: any) {
      console.log("🔴 [AUTH] Token verification failed:", error.message);

      if (error.name === "JsonWebTokenError") {
        res.status(401).json({ message: "Invalid token" });
      } else if (error.name === "TokenExpiredError") {
        res.status(401).json({ message: "Token expired" });
      } else {
        res
          .status(401)
          .json({ message: error?.message || "Not authorized, token failed" });
      }
    }
  } else {
    console.log("🔴 [AUTH] No token or invalid format");
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
