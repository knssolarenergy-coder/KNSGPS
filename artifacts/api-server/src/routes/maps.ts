import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

// GET /maps/token — admin only. Returns the Mapbox access token from the
// server-side MAPBOX_TOKEN env var. The token is never committed in client
// source; the admin live-map screen fetches it at runtime and injects it into
// the map WebView, so no token literal ships in the app bundle or repo.
router.get("/maps/token", requireAdmin, (_req, res) => {
  const token = process.env["MAPBOX_TOKEN"] ?? "";
  res.json({ token });
});

export default router;
