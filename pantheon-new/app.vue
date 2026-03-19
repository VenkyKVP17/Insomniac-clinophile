<template>
  <div class="app-wrapper">
    <Sidebar 
      :agents="agents" 
      :selectedAgentId="selectedAgentId" 
      @select="selectAgent" 
    />

    <main class="main-content">
      <!-- Global Dashboard View -->
      <div v-if="!selectedAgentId" class="dashboard-view">
        <header>
          <div>
            <h1>Pantheon Overview</h1>
            <div class="subtitle">System-wide agent orchestration telemetry</div>
          </div>
          <button @click="fetchAll" class="refresh-button">
            Refresh Data
          </button>
        </header>

        <div class="metrics-grid">
          <div class="glass-panel metric-card">
            <span class="metric-title">Success Rate</span>
            <span class="metric-value">{{ successRate }}%</span>
          </div>
          <div class="glass-panel metric-card">
            <span class="metric-title">Active Agents</span>
            <span class="metric-value">{{ uniqueAgents }}</span>
          </div>
          <div class="glass-panel metric-card">
            <span class="metric-title">Latest Pulse</span>
            <span class="metric-value" style="font-size: 1.25rem">{{ latestActivityTime }}</span>
          </div>
        </div>

        <section class="glass-panel logs-section">
          <div class="logs-header">
            <h2>Real-time Action Stream</h2>
          </div>

          <div v-if="pending" class="loader">Tuning telemetry...</div>
          <div v-else-if="logs.length === 0" class="empty-state">System idle.</div>
          <div v-else class="table-wrapper">
            <table class="log-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Agent</th>
                  <th>Action</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in logs" :key="log.id" @click="selectAgent(log.pa_name.toLowerCase())" style="cursor: pointer">
                  <td>{{ formatDate(log.timestamp) }}</td>
                  <td><span class="pa-chip">{{ log.pa_name }}</span></td>
                  <td>{{ log.action_taken }}</td>
                  <td>
                    <span class="status-badge" :class="log.status === 'SUCCESS' ? 'status-success' : 'status-failed'">
                      {{ log.status }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- Individual Agent Perspective -->
      <AgentDetail v-else :agentId="selectedAgentId" />
    </main>
  </div>
</template>

<script setup>
import '~/assets/agent-ui.css';

const selectedAgentId = ref(null);

const { data: agentsData } = await useFetch('/api/agents/list');
const { data, pending, refresh: refreshLogs } = await useFetch('/api/logs');

const agents = computed(() => agentsData.value?.data || []);
const logs = computed(() => data.value?.data || []);

const selectAgent = (id) => {
  selectedAgentId.value = id;
};

const fetchAll = async () => {
    await refreshLogs();
}

const uniqueAgents = computed(() => {
  const agentNames = new Set(logs.value.map(log => log.pa_name));
  return agentNames.size;
});

const successRate = computed(() => {
  if (logs.value.length === 0) return 100;
  const successes = logs.value.filter(log => log.status === 'SUCCESS').length;
  return Math.round((successes / logs.value.length) * 100);
});

const latestActivityTime = computed(() => {
  if (logs.value.length === 0) return 'Idle';
  const latest = new Date(logs.value[0].timestamp);
  return latest.toLocaleTimeString('en-US', { hour12: false });
});

const formatDate = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour12: false });
};
</script>

<style>
.refresh-button {
  background: var(--accent-primary);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: transform 0.2s;
}

.refresh-button:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.subtitle {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 32px;
}

.metric-title {
  color: var(--text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--accent-secondary);
}

.pa-chip {
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent-secondary);
}

.loader {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: var(--text-muted);
}

.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--text-muted);
}
</style>
