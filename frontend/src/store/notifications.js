// frontend/src/store/notifications.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { defineStore } from "pinia";

const API_BASE = "/api"; // Vite proxy in dev, same origin in production

// Account notifications, backed by the Notification table. This is the source
// of truth for the avatar dot and the /notifications page. Read state lives
// here and on the server, not in a fetch side effect, so a row survives being
// missed as a toast.
export const useNotificationStore = defineStore("notifications", {
  state: () => ({
    items: [],
    unreadCount: 0,
    loading: false,
    loadingMore: false,
    cursor: null, // id to fetch beyond; null means no more pages
    error: false,
    filter: "all", // "all" | "unread"
    // Session-only toast bookkeeping. `lastToastedId` is null until the first
    // poll sets a baseline, so the first sync does not replay history.
    lastToastedId: null,
    toastedIds: new Set(),
  }),

  getters: {
    hasMore: (state) => state.cursor !== null,
  },

  actions: {
    // Cheap count for the avatar dot. Ignore errors: the poll runs often.
    async fetchCount() {
      try {
        const res = await fetch(`${API_BASE}/notifications/unread-count`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        this.unreadCount = Number.isFinite(data.count) ? data.count : 0;
      } catch {
        // Offline or transient; keep the last known count.
      }
    },

    // Page of notifications, newest first. `reset` starts over from the top.
    async fetchList({ reset = false } = {}) {
      if (this.loading || this.loadingMore) return;

      const first = reset || this.items.length === 0;
      if (!first && this.cursor === null) return;

      if (first) this.loading = true;
      else this.loadingMore = true;
      this.error = false;

      try {
        const params = new URLSearchParams({ limit: "20" });
        if (this.filter === "unread") params.set("unread", "true");
        if (!first && this.cursor !== null) {
          params.set("before", String(this.cursor));
        }

        const res = await fetch(`${API_BASE}/notifications?${params}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const incoming = Array.isArray(data.items) ? data.items : [];
        if (first) {
          this.items = incoming;
        } else {
          const seen = new Set(this.items.map((n) => n.id));
          this.items = [...this.items, ...incoming.filter((n) => !seen.has(n.id))];
        }
        this.cursor = data.nextBefore ?? null;
        if (Number.isFinite(data.unreadCount)) this.unreadCount = data.unreadCount;
      } catch {
        this.error = true;
      } finally {
        this.loading = false;
        this.loadingMore = false;
      }
    },

    // Switching All/Unread restarts the list; the two are separate server
    // queries, so cached pages from one filter never leak into the other.
    async setFilter(filter) {
      if (filter !== "unread") filter = "all";
      if (this.filter === filter && this.items.length) return;
      this.filter = filter;
      this.items = [];
      this.cursor = null;
      this.error = false;
      await this.fetchList({ reset: true });
    },

    // What the 30 s poll in store/auth.js calls: refresh the count and return
    // only the rows that arrived since the last poll, for toasting. Rows are
    // not marked read here — the page owns that.
    async pollNew() {
      let data;
      try {
        const params = new URLSearchParams({ limit: "20", unread: "true" });
        const res = await fetch(`${API_BASE}/notifications?${params}`, {
          credentials: "include",
        });
        if (!res.ok) return [];
        data = await res.json();
      } catch {
        return [];
      }

      if (Number.isFinite(data.unreadCount)) this.unreadCount = data.unreadCount;

      const items = Array.isArray(data.items) ? data.items : [];
      const maxId = items.length ? Math.max(...items.map((n) => n.id)) : 0;

      // First poll of the session: remember the high-water mark instead of
      // toasting unread rows that were already waiting before this page load.
      if (this.lastToastedId === null) {
        this.lastToastedId = maxId;
        return [];
      }

      const fresh = items.filter(
        (n) => n.id > this.lastToastedId && !this.toastedIds.has(n.id)
      );
      if (maxId > this.lastToastedId) this.lastToastedId = maxId;
      for (const n of fresh) this.toastedIds.add(n.id);
      return fresh;
    },

    // Optimistic: the row dims now, the count is confirmed by the response.
    async markRead(id) {
      const note = this.items.find((n) => n.id === id);
      if (note && !note.read) {
        note.read = true;
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      }

      try {
        const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (Number.isFinite(data.unreadCount)) this.unreadCount = data.unreadCount;
      } catch {
        // The optimistic update stands; the next poll re-syncs the count.
      }
    },

    async markAllRead() {
      const hadUnread = this.items.some((n) => !n.read) || this.unreadCount > 0;
      for (const n of this.items) n.read = true;
      this.unreadCount = 0;

      try {
        const res = await fetch(`${API_BASE}/notifications/read-all`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        if (hadUnread) await this.fetchCount();
      }
    },

    // Logout, or a different user signs in: nothing from the old session stays.
    reset() {
      this.items = [];
      this.unreadCount = 0;
      this.loading = false;
      this.loadingMore = false;
      this.cursor = null;
      this.error = false;
      this.filter = "all";
      this.lastToastedId = null;
      this.toastedIds = new Set();
    },
  },
});
