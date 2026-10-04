// backend/src/routes/notifications.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Notification Routes
 * --------------------
 * Account notifications: the rows produced by the activity pipeline and by the
 * team routes. They feed the badge on the avatar and the /notifications page.
 *
 * Read state belongs to the client. Fetching never marks anything read; the
 * frontend calls /:id/read when a row is opened and /read-all explicitly. The
 * old GET /unread marked everything read on fetch, so a missed toast was gone
 * for good. See docs/teams.md.
 *
 * Every query is scoped to req.currentUser, attached by the auth middleware in
 * routes/auth.js. A notification id alone never reaches another user's row.
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function currentUser(req) {
  return req.currentUser || req.user || null;
}

function serialize(n) {
  return {
    id: n.id,
    message: n.message,
    type: n.type,
    link: n.link || null,
    read: n.read,
    createdAt: n.createdAt,
  };
}

export function mountNotificationsRoutes(app, prisma) {
  // GET /api/notifications?limit=&before=&unread=1&type=
  // Newest first, paged by id cursor. `unreadCount` is always the total unread
  // so the avatar dot does not change when a tab filters the list.
  app.get("/api/notifications", async (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(
      Math.max(Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );

    const before = Number.parseInt(req.query.before, 10);
    const unreadOnly = req.query.unread === "true" || req.query.unread === "1";
    const type =
      typeof req.query.type === "string" && req.query.type ? req.query.type : null;

    const where = { userId: user.id };
    if (unreadOnly) where.read = false;
    if (type) where.type = type;
    if (Number.isFinite(before)) where.id = { lt: before };

    try {
      const [items, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { id: "desc" },
          take: limit,
        }),
        prisma.notification.count({ where: { userId: user.id, read: false } }),
      ]);

      res.json({
        items: items.map(serialize),
        unreadCount,
        nextBefore: items.length === limit ? items[items.length - 1].id : null,
      });
    } catch (err) {
      console.error("❌ Failed to fetch notifications:", err);
      res.status(500).json({ error: "Error fetching notifications" });
    }
  });

  // GET /api/notifications/unread-count — the cheap poll behind the avatar dot.
  app.get("/api/notifications/unread-count", async (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    try {
      const count = await prisma.notification.count({
        where: { userId: user.id, read: false },
      });
      res.json({ count });
    } catch (err) {
      console.error("❌ Failed to count unread notifications:", err);
      res.status(500).json({ error: "Error counting notifications" });
    }
  });

  // POST /api/notifications/:id/read — opening a row. `updateMany` with the
  // userId in the where clause means a guessed id cannot touch another user.
  app.post("/api/notifications/:id/read", async (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    try {
      await prisma.notification.updateMany({
        where: { id, userId: user.id, read: false },
        data: { read: true },
      });
      const count = await prisma.notification.count({
        where: { userId: user.id, read: false },
      });
      res.json({ ok: true, unreadCount: count });
    } catch (err) {
      console.error("❌ Failed to mark notification read:", err);
      res.status(500).json({ error: "Error marking notification read" });
    }
  });

  // POST /api/notifications/read-all
  app.post("/api/notifications/read-all", async (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    try {
      await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
      res.json({ ok: true, unreadCount: 0 });
    } catch (err) {
      console.error("❌ Failed to mark all notifications read:", err);
      res.status(500).json({ error: "Error marking notifications read" });
    }
  });
}
