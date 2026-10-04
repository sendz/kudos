// frontend/src/utils/notificationMeta.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

// How each notification type looks. The toast and the /notifications page both
// read this so an icon keeps the same meaning in both places. Accents are LCP
// colour-scheme variables (see CLAUDE.md); no ad-hoc hex here.
//
// Types are written by the backend: the activity pipeline emits `kudos`,
// `badge` and `follow`, routes/teams.js and routes/admin.js emit the `team_*`
// ones. Anything unknown falls back to a neutral bell.

const TYPES = {
  kudos: { icon: "💚", accent: "var(--geeko-green)" },
  badge: { icon: "🏅", accent: "var(--yarrow-yellow)" },
  follow: { icon: "⭐", accent: "var(--plum-purple)" },
  team_invite: { icon: "🤝", accent: "var(--butterfly-blue)" },
  team_join_request: { icon: "🙋", accent: "var(--butterfly-blue)" },
  team_invite_accepted: { icon: "✅", accent: "var(--butterfly-blue)" },
  team_join_approved: { icon: "✅", accent: "var(--butterfly-blue)" },
  team_added: { icon: "➕", accent: "var(--butterfly-blue)" },
  team_removed: { icon: "➖", accent: "var(--radish-red)" },
  info: { icon: "🔔", accent: "var(--text-muted)" },
};

const FALLBACK = { icon: "🔔", accent: "var(--text-muted)" };

export function notificationMeta(type) {
  return TYPES[type] || FALLBACK;
}
