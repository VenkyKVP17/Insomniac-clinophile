<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h1>PANTHEON ⚡</h1>
    </div>
    <div class="agent-list">
      <div 
        class="agent-item" 
        :class="{ active: !selectedAgentId }"
        @click="$emit('select', null)"
      >
        <span class="agent-emoji">📊</span>
        <span>Dashboard</span>
      </div>
      
      <div 
        v-for="agent in agents" 
        :key="agent.name"
        class="agent-item"
        :class="{ active: selectedAgentId === agent.name.toLowerCase() }"
        @click="$emit('select', agent.name.toLowerCase())"
      >
        <span class="agent-emoji">{{ getEmoji(agent.name) }}</span>
        <span>{{ agent.name }}</span>
      </div>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  agents: Array,
  selectedAgentId: String
});

defineEmits(['select']);

const getEmoji = (name) => {
  const emojis = {
    'NYX': '🌙',
    'ZEUS': '⚡',
    'HERA': '🦚',
    'CHRONOS': '⏳',
    'ASCLEPIUS': '⚕️',
    'PLUTUS': '💰',
    'GROK': '🎨',
    'ARGUS': '👁️',
    'HERACLES': '🏋️',
    'EPIONE': '💊',
    'IRIS': '🌈',
    'HERMES': '👟',
    'HERMES-Contacts': '📇',
    'DEMETER': '🌾',
    'HYGIEIA': '🚿',
    'ASTERIA': '🌌',
    'PROTEUS': '🤖',
    'MOIRA': '🧵',
    'ATHENA': '🛡️',
    'HEPHAESTUS': '⚒️',
    'CHIRON': '🏹',
    'AEACUS': '⚖️',
    'RHADAMANTHUS': '📜',
    'MIDAS': '🪙',
    'METIS': '🦉'
  };
  return emojis[name] || '🤖';
};
</script>
