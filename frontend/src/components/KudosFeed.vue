<!--
Copyright © 2025–present Lubos Kocman and openSUSE contributors
SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="kudos-feed" :class="{ 'kudos-feed--compact': compact, flicker }">
    <router-link
      v-for="k in kudos"
      :key="k.id"
      class="kudo-line"
      :class="{ 'group-kudo': isGroupKudo(k) }"
      :to="`/kudo/${k.slug}`"
    >
      <span class="icon">{{ k.category?.icon || "💚" }}</span>

      <router-link v-if="linkUsers" :to="`/user/${k.fromUser.username}`" class="user" @click.stop>
        @{{ k.fromUser.username }}
      </router-link>
      <span v-else class="user">@{{ k.fromUser.username }}</span>

      <template v-if="showRecipient">
        <span aria-hidden="true">→</span>

        <template v-if="isGroupKudo(k)">
          <span class="users-group">
            <template v-for="(r, idx) in k.recipients" :key="r.userId || idx">
              <router-link v-if="linkUsers" :to="`/user/${r.user.username}`" class="user" @click.stop>
                @{{ r.user.username }}
              </router-link>
              <span v-else class="user">@{{ r.user.username }}</span>
              <span v-if="idx < k.recipients.length - 1" class="separator">, </span>
            </template>
          </span>
          <span class="group-badge">👥</span>
        </template>
        <template v-else>
          <router-link v-if="linkUsers" :to="`/user/${k.recipients[0]?.user.username}`" class="user" @click.stop>
            @{{ k.recipients[0]?.user.username }}
          </router-link>
          <span v-else class="user">@{{ k.recipients[0]?.user.username }}</span>
        </template>
      </template>

      <span class="message">"{{ k.message }}"</span>

      <span class="timestamp">
        <template v-if="k.internal">{{ t("user_profile.team_kudos_internal") }} · </template>
        {{ formatTime(k.createdAt) }}
      </span>
    </router-link>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";

const props = defineProps({
  kudos: { type: Array, required: true },
  compact: { type: Boolean, default: false },
  flicker: { type: Boolean, default: false },
  showRecipient: { type: Boolean, default: true },
  linkUsers: { type: Boolean, default: false },
  relativeTime: { type: Boolean, default: false },
});

const { t } = useI18n();

function isGroupKudo(kudo) {
  return kudo.recipients?.length > 1;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  if (props.relativeTime) {
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "now";
    if (diff < 3600) return `${Math.floor(diff / 60)} m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
    return `${Math.floor(diff / 86400)} d ago`;
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
</script>

<style scoped>
/* Group-kudo bits are shared across every feed; the base .kudos-feed /
   .kudo-line styles live in base.css. */
.kudo-line.group-kudo {
  background: rgba(115, 186, 37, 0.05);
}

.users-group {
  display: inline-flex;
  gap: 0;
  align-items: center;
}

.users-group .user {
  margin-right: 0;
  color: var(--geeko-green);
}

.separator {
  margin-right: 0.4rem;
}

.group-badge {
  display: inline-block;
  margin: 0 0.6rem;
  padding: 0 0.4rem;
  color: var(--geeko-green);
  font-weight: bold;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
