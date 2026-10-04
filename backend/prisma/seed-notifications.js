// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0
//
// Dev-only: fills the notification page and the avatar dot with sample rows so
// the UI can be exercised without waiting for real kudos, badges and team
// events. It refuses to run under NODE_ENV=production.
//
// Run it with `npm run seed:notifications` (add --force to replace existing
// rows for the seeded users). runme-clean.sh calls it after the other seeds.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// The dev OIDC test users from seed.js; either works for manual testing.
const TARGETS = ["BobSmith", "AliceSmith"];
const FORCE = process.argv.includes("--force");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ago = (ms) => new Date(Date.now() - ms);

// Point the sample rows at real pages where the dev data allows it, so a click
// lands somewhere meaningful instead of a 404.
async function buildContext(user) {
  const [kudo, userBadge, follower, team] = await Promise.all([
    prisma.kudos.findFirst({
      where: {
        OR: [
          { recipients: { some: { userId: user.id } } },
          { fromUserId: user.id },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { slug: true },
    }),
    prisma.userBadge.findFirst({
      where: { userId: user.id },
      orderBy: { grantedAt: "desc" },
      select: { badge: { select: { slug: true, title: true } } },
    }),
    prisma.follow.findFirst({
      where: { followingId: user.id },
      select: { follower: { select: { username: true } } },
    }),
    prisma.user.findFirst({
      where: { role: "TEAM" },
      select: { username: true, fullName: true },
    }),
  ]);

  return {
    kudoPath: kudo ? `/kudo/${encodeURIComponent(kudo.slug)}` : "/kudos",
    badgeTitle: userBadge?.badge?.title ?? "Community Hero",
    badgePath: userBadge
      ? `/badge/${encodeURIComponent(userBadge.badge.slug)}/earned-by/${encodeURIComponent(user.username)}`
      : "/badges",
    follower: follower?.follower?.username ?? "carmeleon",
    team: team?.username ?? "agama",
    teamName: team?.fullName || team?.username || "agama",
  };
}

// One row per notification type the app actually emits, with a mix of read and
// unread and timestamps spread over the last week so the page and the count
// have something to show.
function buildRows(user, ctx) {
  const teamAction = `/teams?team=${encodeURIComponent(ctx.team)}`;
  const teamPage = `/user/${encodeURIComponent(ctx.team)}`;

  return [
    {
      type: "kudos",
      message: `💚 ${ctx.follower} sent you kudos — "Thanks for the Leap installer help!"`,
      link: ctx.kudoPath,
      read: false,
      createdAt: ago(4 * MINUTE),
    },
    {
      type: "badge",
      message: `🏅 Badge earned: ${ctx.badgeTitle}`,
      link: ctx.badgePath,
      read: false,
      createdAt: ago(35 * MINUTE),
    },
    {
      type: "follow",
      message: `⭐ ${ctx.follower} started following your updates.`,
      link: `/user/${encodeURIComponent(ctx.follower)}`,
      read: false,
      createdAt: ago(2 * HOUR),
    },
    {
      type: "team_join_request",
      message: `heavencp asked to join ${ctx.teamName}`,
      link: teamAction,
      read: false,
      createdAt: ago(3 * HOUR),
    },
    {
      type: "team_invite",
      message: `knurft invited you to join ${ctx.teamName}`,
      link: teamAction,
      read: false,
      createdAt: ago(6 * HOUR),
    },
    {
      type: "team_join_approved",
      message: `You are now a member of ${ctx.teamName}`,
      link: teamPage,
      read: true,
      createdAt: ago(1 * DAY),
    },
    {
      type: "team_invite_accepted",
      message: `brightstar accepted your invitation to ${ctx.teamName}`,
      link: teamPage,
      read: true,
      createdAt: ago(2 * DAY),
    },
    {
      type: "team_added",
      message: `An admin added you to ${ctx.teamName}`,
      link: teamPage,
      read: true,
      createdAt: ago(3 * DAY),
    },
    {
      type: "info",
      message:
        "🔔 Welcome to openSUSE Kudos! Kudos, badges and team updates will show up here.",
      link: null,
      read: false,
      createdAt: ago(5 * DAY),
    },
    {
      type: "team_removed",
      message: `carmeleon removed you from ${ctx.teamName}`,
      link: teamPage,
      read: true,
      createdAt: ago(9 * DAY),
    },
  ];
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.log("⏭️  seed-notifications is dev-only (NODE_ENV=production). Skipping.");
    return;
  }

  console.log("🌱 Seeding dummy notifications (dev only)");

  const users = await prisma.user.findMany({
    where: { username: { in: TARGETS } },
    select: { id: true, username: true },
  });

  if (!users.length) {
    console.warn(`⚠️  None of ${TARGETS.join(", ")} exist. Run seed.js first.`);
    return;
  }

  let total = 0;

  for (const user of users) {
    const existing = await prisma.notification.count({
      where: { userId: user.id },
    });

    if (existing > 0 && !FORCE) {
      console.log(
        `⏭️  ${user.username} already has ${existing} notification(s); skipping. Use --force to replace them.`
      );
      continue;
    }

    if (existing > 0) {
      await prisma.notification.deleteMany({ where: { userId: user.id } });
      console.log(`🧹 Cleared ${existing} existing notification(s) for ${user.username}.`);
    }

    const ctx = await buildContext(user);
    const rows = buildRows(user, ctx);

    await prisma.notification.createMany({
      data: rows.map((row) => ({ ...row, userId: user.id })),
    });

    const unread = rows.filter((row) => !row.read).length;
    console.log(`🔔 ${user.username}: ${rows.length} notifications (${unread} unread).`);
    total += rows.length;
  }

  console.log(`🌳 Seeded ${total} dummy notification(s).`);
}

main()
  .catch((e) => {
    console.error("💥 Notification seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
