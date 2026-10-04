<!--
Copyright © 2025–present Lubos Kocman
and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<!--
  Your notifications. A row is unread until you open it or press "Mark all as
  read"; the avatar dot and the profile-menu count mirror the same store. See
  docs/teams.md for why read state moved off the fetch.
-->
<template>
  <div class="notifications-view">
    <section class="section-box">
      <header class="page-head">
        <h2>🔔 {{ t('notifications.title') }}</h2>
        <button
          v-if="auth.user && unreadCount > 0"
          type="button"
          class="mark-all"
          :disabled="markingAll"
          @click="markAll"
        >
          {{ t('notifications.mark_all_read') }}
        </button>
      </header>

      <!-- Reachable by URL before login; the header only links it when signed in. -->
      <div v-if="!auth.user" class="login-prompt">
        <p class="hint">{{ t('notifications.login_required') }}</p>
        <a class="login-link" :href="loginUrl">{{ t('notifications.login') }}</a>
      </div>

      <template v-else>
        <div class="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="filter === 'all'"
            class="tab"
            :class="{ active: filter === 'all' }"
            @click="setFilter('all')"
          >
            {{ t('notifications.all') }}
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="filter === 'unread'"
            class="tab"
            :class="{ active: filter === 'unread' }"
            @click="setFilter('unread')"
          >
            {{ t('notifications.unread') }}
            <span v-if="unreadCount" class="tab-count">{{ unreadCount }}</span>
          </button>
        </div>

        <p v-if="loading" class="hint">{{ t('notifications.loading') }}</p>
        <p v-else-if="error" class="error">{{ t('notifications.failed') }}</p>
        <p v-else-if="!items.length" class="hint">
          {{ filter === 'unread' ? t('notifications.empty_unread') : t('notifications.empty') }}
        </p>

        <ul v-else class="notification-list">
          <li v-for="n in items" :key="n.id">
            <button
              type="button"
              class="row"
              :class="{ unread: !n.read }"
              @click="open(n)"
            >
              <span
                class="row-icon"
                :style="{ borderColor: meta(n.type).accent }"
                aria-hidden="true"
              >{{ meta(n.type).icon }}</span>
              <span class="row-body">
                <span class="row-message">{{ n.message }}</span>
                <span class="row-time">{{ relativeTime(n.createdAt) }}</span>
              </span>
              <span v-if="!n.read" class="row-dot" aria-hidden="true"></span>
            </button>
          </li>
        </ul>

        <div v-if="hasMore" class="more">
          <button
            type="button"
            class="load-more"
            :disabled="loadingMore"
            @click="loadMore"
          >
            {{ loadingMore ? t('notifications.loading') : t('notifications.load_more') }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../store/auth";
import { useNotificationStore } from "../store/notifications";
import { notificationMeta } from "../utils/notificationMeta";
import { formatRelativeTime } from "../utils/time";

const { t, locale } = useI18n();
const auth = useAuthStore();
const store = useNotificationStore();
const router = useRouter();

const markingAll = ref(false);

const items = computed(() => store.items);
const unreadCount = computed(() => store.unreadCount);
const loading = computed(() => store.loading);
const loadingMore = computed(() => store.loadingMore);
const error = computed(() => store.error);
const hasMore = computed(() => store.hasMore);
const filter = computed(() => store.filter);

const loginUrl = `${import.meta.env.VITE_API_BASE}/login?returnTo=${encodeURIComponent("/notifications")}`;

const meta = notificationMeta;

function relativeTime(value) {
  return formatRelativeTime(value, locale.value);
}

async function setFilter(value) {
  await store.setFilter(value);
}

async function loadMore() {
  await store.fetchList();
}

async function open(n) {
  await store.markRead(n.id);
  if (n.link) router.push(n.link);
}

async function markAll() {
  markingAll.value = true;
  try {
    await store.markAllRead();
  } finally {
    markingAll.value = false;
  }
}

onMounted(() => {
  if (!auth.user) return;
  store.fetchList({ reset: true });
  store.fetchCount();
});
</script>

<style scoped>
.notifications-view {
  max-width: 760px;
  margin: 0 auto;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.page-head h2 {
  margin: 0;
}

.mark-all {
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--divider);
  border-radius: 8px;
  background: transparent;
  color: var(--geeko-green);
  font-family: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.mark-all:hover:not(:disabled) {
  background: var(--geeko-green);
  color: var(--maple-maroon);
}

.mark-all:disabled {
  opacity: 0.5;
  cursor: default;
}

.login-prompt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.login-link {
  display: inline-block;
  padding: 0.5rem 1rem;
  border: 1px solid var(--geeko-green);
  border-radius: 8px;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin: 1rem 0 0.5rem;
  border-bottom: 1px solid var(--divider);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border: none;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 1rem;
  cursor: pointer;
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--geeko-green);
}

.tab-count {
  min-width: 1.4em;
  padding: 0 0.35em;
  border-radius: 999px;
  background: var(--count-bg);
  color: #fff;
  font-size: 0.75em;
  line-height: 1.5em;
  text-align: center;
}

.notification-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--divider);
  border-left: 3px solid transparent;
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.row:hover {
  background: var(--card-hover-bg);
  border-color: var(--geeko-green);
}

.row.unread {
  border-left-color: var(--geeko-green);
}

.row-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  border: 2px solid var(--divider);
  border-radius: 50%;
  font-size: 1.1rem;
}

.row-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.row-message {
  overflow-wrap: anywhere;
}

.row-time {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.row-dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--radish-red);
}

.more {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.load-more {
  padding: 0.55rem 1.2rem;
  border: 1px dashed var(--geeko-green);
  border-radius: 8px;
  background: transparent;
  color: var(--geeko-green);
  font-family: inherit;
  font-size: 1rem;
  cursor: pointer;
}

.load-more:hover:not(:disabled) {
  background: var(--geeko-green);
  color: var(--maple-maroon);
}

.load-more:disabled {
  opacity: 0.6;
  cursor: default;
}

.error {
  color: var(--radish-red);
}

@media (max-width: 600px) {
  .page-head {
    align-items: flex-start;
  }

  .mark-all {
    width: 100%;
  }
}
</style>
