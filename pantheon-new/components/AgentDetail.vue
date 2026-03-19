<template>
  <div v-if="loading" class="loader">Scanning agent frequency...</div>
  <div v-else-if="agent" class="agent-detail">
    <div class="agent-header">
      <div class="agent-header-emoji">{{ emoji }}</div>
      <div class="agent-title-info">
        <div class="agent-domain">{{ agent.data.info.domain }}</div>
        <h2>{{ agent.data.info.name }} <span class="deity-tag">{{ agent.data.info.deity }}</span></h2>
        <div class="agent-notes">{{ agent.data.info.notes }}</div>
      </div>
    </div>

    <div class="details-grid">
      <section class="glass-panel">
        <h3>Activity Timeline</h3>
        <table class="log-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in agent.data.logs" :key="log.id">
              <td>{{ formatDate(log.timestamp) }}</td>
              <td>{{ log.action_taken }}</td>
              <td>
                <span class="status-badge" :class="log.status === 'SUCCESS' ? 'status-success' : 'status-failed'">
                  {{ log.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="agent.data.logs.length === 0" class="empty-state">No recent activity detected.</div>
      </section>

      <section class="glass-panel">
        <h3>Communication Feed</h3>
        <div class="comms-list">
          <div v-for="msg in agent.data.communication" :key="msg.id" class="message-card">
            <div class="message-meta">
              <span>{{ msg.category || 'General' }}</span>
              <span>{{ formatDate(msg.created_at) }}</span>
            </div>
            <div class="message-text">{{ msg.message }}</div>
          </div>
        </div>
        <div v-if="agent.data.communication.length === 0" class="empty-state">No recent messages.</div>
      </section>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  agentId: String
});

const { data: agent, pending: loading } = await useFetch(() => `/api/agents/${props.agentId}`);

const emoji = computed(() => {
    if (!agent.value?.data?.info?.name) return '🤖';
    const emojis = {
        'NYX': '🌙', 'ZEUS': '⚡', 'HERA': '🦚', 'CHRONOS': '⏳', 'ASCLEPIUS': '⚕️',
        'PLUTUS': '💰', 'GROK': '🎨', 'ARGUS': '👁️', 'HERACLES': '🏋️', 'EPIONE': '💊',
        'IRIS': '🌈', 'HERMES': '👟', 'HERMES-Contacts': '📇', 'DEMETER': '🌾',
        'HYGIEIA': '🚿', 'ASTERIA': '🌌', 'PROTEUS': '🤖', 'MOIRA': '🧵',
        'ATHENA': '🛡️', 'HEPHAESTUS': '⚒️', 'CHIRON': '🏹', 'AEACUS': '⚖️',
        'RHADAMANTHUS': '📜', 'MIDAS': '🪙', 'METIS': '🦉'
    };
    return emojis[agent.value.data.info.name] || '🤖';
});

const formatDate = (isoString) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
};
</script>
