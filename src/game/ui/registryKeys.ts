export const REGISTRY_KEYS = {
  hud: 'hud',
  interaction: 'showInteraction',
  uiPanel: 'uiPanel',
  dialogue: 'dialogueState',
  inventory: 'inventoryState',
  character: 'characterState',
  questJournal: 'questJournalState',
  worldMap: 'worldMapState',
  settings: 'settingsState',
  notification: 'uiNotification'
} as const;

export type UiPanel = '' | 'inventory' | 'character' | 'quests' | 'map' | 'settings' | 'credits' | 'dialogue' | 'pause';
