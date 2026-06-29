import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import bookingsRouter from "./bookings.js";
import complaintsRouter from "./complaints.js";
import settingsRouter from "./settings.js";
import chatRouter from "./chat.js";
import techniciansRouter from "./technicians.js";
import quotesRouter from "./quotes.js";
import warrantiesRouter from "./warranties.js";
import referralRouter from "./referral.js";
import sitesRouter from "./sites.js";
import siteVisitsRouter from "./site-visits.js";
import storageRouter from "./storage.js";
import attendanceRouter from "./attendance.js";
import reportsRouter from "./reports.js";
import mapsRouter from "./maps.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(bookingsRouter);
router.use(complaintsRouter);
router.use(settingsRouter);
router.use(chatRouter);
router.use(techniciansRouter);
router.use(quotesRouter);
router.use(warrantiesRouter);
router.use(referralRouter);
router.use(sitesRouter);
router.use(siteVisitsRouter);
router.use(storageRouter);
router.use(attendanceRouter);
router.use(reportsRouter);
router.use(mapsRouter);

export default router;
