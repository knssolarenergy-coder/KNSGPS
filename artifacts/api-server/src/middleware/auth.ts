import type { NextFunction, Request, Response } from "express";
import { verifyToken, type AuthPayload } from "../lib/jwt.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    req.auth = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      req.auth = verifyToken(header.slice(7));
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
  }
  if (!req.auth.isAdmin) {
    res.status(403).json({ error: "Forbidden — admin only" });
    return;
  }
  next();
}

export function requireTechnician(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      req.auth = verifyToken(header.slice(7));
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
  }
  if (!req.auth.isTechnician && !req.auth.isAdmin) {
    res.status(403).json({ error: "Forbidden — technician or admin only" });
    return;
  }
  next();
}
