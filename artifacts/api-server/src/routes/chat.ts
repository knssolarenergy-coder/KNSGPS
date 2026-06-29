import { and, desc, eq, ne, sql } from "drizzle-orm";
import { Router } from "express";
import { db, chatMessages, users } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

router.get("/chat/messages", requireAuth, async (req, res) => {
  try {
    const msgs = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, req.auth!.userId))
      .orderBy(chatMessages.createdAt);

    await db
      .update(chatMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(chatMessages.userId, req.auth!.userId),
          eq(chatMessages.isAdminSender, true),
          eq(chatMessages.isRead, false),
        ),
      );

    res.json(msgs);
  } catch (err) {
    req.log.error({ err }, "Failed to get chat messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/chat/messages", requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !String(message).trim()) {
      res.status(400).json({ error: "Message is required" });
      return;
    }
    const [msg] = await db
      .insert(chatMessages)
      .values({
        id: generateId(),
        userId: req.auth!.userId,
        isAdminSender: false,
        message: String(message).trim(),
        isRead: false,
      })
      .returning();
    res.status(201).json(msg);
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/chat/admin/conversations", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select({
        userId: chatMessages.userId,
        lastMessage: sql<string>`(SELECT message FROM chat_messages cm2 WHERE cm2.user_id = ${chatMessages.userId} ORDER BY cm2.created_at DESC LIMIT 1)`,
        lastAt: sql<string>`(SELECT created_at FROM chat_messages cm2 WHERE cm2.user_id = ${chatMessages.userId} ORDER BY cm2.created_at DESC LIMIT 1)`,
        unreadCount: sql<number>`COUNT(CASE WHEN ${chatMessages.isAdminSender} = false AND ${chatMessages.isRead} = false THEN 1 END)`,
        userName: sql<string>`(SELECT name FROM users u WHERE u.id = ${chatMessages.userId})`,
        userPhone: sql<string>`(SELECT phone FROM users u WHERE u.id = ${chatMessages.userId})`,
      })
      .from(chatMessages)
      .groupBy(chatMessages.userId)
      .orderBy(desc(sql`(SELECT created_at FROM chat_messages cm2 WHERE cm2.user_id = ${chatMessages.userId} ORDER BY cm2.created_at DESC LIMIT 1)`));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get conversations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/chat/admin/:userId/messages", requireAuth, requireAdmin, async (req, res) => {
  try {
    const msgs = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, String(req.params.userId)))
      .orderBy(chatMessages.createdAt);

    await db
      .update(chatMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(chatMessages.userId, String(req.params.userId)),
          eq(chatMessages.isAdminSender, false),
          eq(chatMessages.isRead, false),
        ),
      );

    res.json(msgs);
  } catch (err) {
    req.log.error({ err }, "Failed to get user messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/chat/admin/:userId/reply", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !String(message).trim()) {
      res.status(400).json({ error: "Message is required" });
      return;
    }
    const [msg] = await db
      .insert(chatMessages)
      .values({
        id: generateId(),
        userId: String(req.params.userId),
        isAdminSender: true,
        message: String(message).trim(),
        isRead: false,
      })
      .returning();
    res.status(201).json(msg);
  } catch (err) {
    req.log.error({ err }, "Failed to send admin reply");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
