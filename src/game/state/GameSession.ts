import { defaultContent } from '../content/defaultContent';
import type { DialogueData, ItemData, QuestData } from '../content/schemas';
import { Inventory } from '../systems/inventory/Inventory';
import { PerkTree } from '../systems/perks/PerkTree';
import { QuestStateMachine, type QuestStatus } from '../systems/quests/QuestStateMachine';
import type {
  EquipmentState,
  EquipmentUpgradeState,
  FactionId,
  HudViewModel,
  InventoryUiEntry,
  PerkDefinition,
  PlayerStats,
  QuestUiEntry,
  RegionState,
  RewardPackage,
  SessionSnapshot,
  ShopRuntimeState,
  WeaponMode
} from './types';

const BASE_PLAYER: PlayerStats = {
  level: 1,
  xp: 0,
  xpToNext: 100,
  hp: 100,
  maxHp: 100,
  stamina: 100,
  maxStamina: 100,
  attack: 12,
  defense: 6,
  crit: 0.05,
  moveSpeed: 145
};

const BASE_EQUIPMENT: EquipmentState = {
  weapon: 'weapon_warden_blade',
  offhand: null,
  armor: null,
  trinkets: [null, null],
  weaponMode: 'sword'
};

const BASE_REPUTATIONS: Record<FactionId, number> = {
  archivists: 0,
  pilgrims: 0,
  foundry: 0
};

const BASE_UPGRADES: EquipmentUpgradeState = {
  weapon: 0,
  armor: 0
};

const BASE_SHOP_STATE: ShopRuntimeState = {
  stockByListingId: {},
  restockProgress: 0
};

interface QuestDefinitionIndex {
  title: string;
  objectives: Array<{ id: string; description: string; required: number }>;
}

function normalizePerkDefinitions(): PerkDefinition[] {
  return (defaultContent.perks as Array<{
    id: string;
    branch: string;
    name: string;
    description: string;
    maxRank: number;
    effects: Record<string, number | undefined>;
  }>).map((perk) => ({
    id: perk.id,
    branch: perk.branch as PerkDefinition['branch'],
    name: perk.name,
    description: perk.description,
    maxRank: perk.maxRank,
    effects: Object.fromEntries(
      Object.entries(perk.effects).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    )
  }));
}

export class GameSession {
  public readonly inventory: Inventory;
  public readonly quests: QuestStateMachine;
  public readonly perks: PerkTree;

  private readonly itemsById = new Map<string, ItemData>();
  private readonly questDisplayIndex = new Map<string, QuestDefinitionIndex>();
  private readonly dialoguesById = new Map<string, DialogueData>();

  private stats: PlayerStats;
  private cinders = 80;
  private equipment: EquipmentState;
  private upgrades: EquipmentUpgradeState = { ...BASE_UPGRADES };
  private shopState: ShopRuntimeState = { ...BASE_SHOP_STATE };
  private flags: Record<string, string | number | boolean> = {};
  private reputations: Record<FactionId, number> = { ...BASE_REPUTATIONS };
  private regions: RegionState = {
    unlocked: ['cinderhaven', 'gloamwood'],
    discovered: ['cinderhaven']
  };
  private readonly eventLog: string[] = [];

  public constructor(snapshot?: SessionSnapshot) {
    this.inventory = snapshot ? Inventory.fromSerialized(snapshot.inventory) : new Inventory(6, 8, 8);
    this.quests = snapshot ? QuestStateMachine.fromSerialized(snapshot.quests) : new QuestStateMachine();
    this.perks = new PerkTree(normalizePerkDefinitions(), snapshot?.perks);

    this.stats = snapshot ? { ...snapshot.player } : { ...BASE_PLAYER };
    this.cinders = snapshot?.cinders ?? this.cinders;
    this.equipment = snapshot ? { ...snapshot.equipment, trinkets: [...snapshot.equipment.trinkets] as [string | null, string | null] } : { ...BASE_EQUIPMENT };
    this.upgrades = {
      weapon: snapshot?.upgrades?.weapon ?? BASE_UPGRADES.weapon,
      armor: snapshot?.upgrades?.armor ?? BASE_UPGRADES.armor
    };
    this.shopState = {
      stockByListingId: { ...(snapshot?.shop?.stockByListingId ?? {}) },
      restockProgress: snapshot?.shop?.restockProgress ?? 0
    };
    this.flags = { ...(snapshot?.worldFlags ?? {}) };
    this.reputations = { ...BASE_REPUTATIONS, ...(snapshot?.reputations ?? {}) };
    this.regions = snapshot ? { unlocked: [...snapshot.regions.unlocked], discovered: [...snapshot.regions.discovered] } : this.regions;

    for (const entry of snapshot?.eventLog ?? []) {
      this.log(entry);
    }

    this.loadContentIndexes();
    this.initializeQuests();
    this.syncQuestFlagsFromWorldFlags();

    if (!snapshot) {
      this.seedStartingInventory();
      this.log('Warden deployed to Cinderhaven fringe.');
    }

    this.recomputeDerivedStats();
    this.quests.syncAvailability();
  }

  public getStats(): PlayerStats {
    return { ...this.stats };
  }

  public setWeaponMode(mode: WeaponMode): void {
    this.equipment.weaponMode = mode;
    this.log(`Weapon stance switched: ${mode}.`);
  }

  public getWeaponMode(): WeaponMode {
    return this.equipment.weaponMode;
  }

  public getEquipment(): EquipmentState {
    return {
      ...this.equipment,
      trinkets: [...this.equipment.trinkets] as [string | null, string | null]
    };
  }

  public getEquipmentUpgrades(): EquipmentUpgradeState {
    return { ...this.upgrades };
  }

  public setEquipmentUpgradeLevel(target: 'weapon' | 'armor', level: number): void {
    this.upgrades[target] = Math.max(0, Math.min(5, Math.floor(level)));
    this.recomputeDerivedStats();
    this.log(`${target.toUpperCase()} upgraded to +${this.upgrades[target]}.`);
  }

  public isAlive(): boolean {
    return this.stats.hp > 0;
  }

  public discoverRegion(regionId: string): void {
    if (!this.regions.discovered.includes(regionId)) {
      this.regions.discovered.push(regionId);
      this.awardXp(20);
      this.log(`Discovered ${regionId}.`);
    }
  }

  public unlockRegion(regionId: string): void {
    if (!this.regions.unlocked.includes(regionId)) {
      this.regions.unlocked.push(regionId);
      this.log(`Unlocked region: ${regionId}.`);
    }
  }

  public getRegions(): RegionState {
    return {
      unlocked: [...this.regions.unlocked],
      discovered: [...this.regions.discovered]
    };
  }

  public setFlag(flagId: string, value: string | number | boolean): void {
    this.flags[flagId] = value;
    if (typeof value === 'boolean') {
      this.quests.setFlag(flagId, value);
    }
    this.quests.syncAvailability();
  }

  public getFlag(flagId: string): string | number | boolean | undefined {
    return this.flags[flagId];
  }

  public getReputation(factionId: FactionId): number {
    return this.reputations[factionId] ?? 0;
  }

  public addReputation(factionId: FactionId, amount: number): void {
    this.reputations[factionId] = (this.reputations[factionId] ?? 0) + amount;
    this.log(`${factionId} reputation ${amount >= 0 ? '+' : ''}${amount}.`);
  }

  public getItem(itemId: string): ItemData | undefined {
    return this.itemsById.get(itemId);
  }

  public getItemValue(itemId: string): number {
    return this.itemsById.get(itemId)?.value ?? 1;
  }

  public canSellItem(itemId: string): boolean {
    const item = this.itemsById.get(itemId);
    if (!item) {
      return true;
    }

    return item.type !== 'quest' && item.type !== 'key';
  }

  public addItem(itemId: string, amount: number, maxStack?: number): number {
    const item = this.itemsById.get(itemId);
    const stack = maxStack ?? item?.stackSize ?? 99;

    const overflow = this.inventory.addItem({
      itemId,
      amount,
      maxStack: stack,
      tags: this.inferTags(itemId)
    });

    const received = amount - overflow;
    if (received > 0) {
      this.log(`Received ${item?.name ?? itemId} x${received}.`);
      this.recordObjectiveProgress('collect', itemId, received);
    }

    return overflow;
  }

  public recordObjectiveProgress(
    objectiveType: 'kill' | 'collect' | 'talk' | 'enter_zone' | 'solve_puzzle',
    targetId: string,
    amount = 1
  ): void {
    const progressAmount = Math.max(1, Math.floor(amount));

    for (const questData of defaultContent.quests as QuestData[]) {
      const activeQuest = this.quests.getQuest(questData.id);
      if (!activeQuest || activeQuest.status !== 'active') {
        continue;
      }

      for (const objective of questData.objectives) {
        if (objective.type !== objectiveType || objective.targetId !== targetId) {
          continue;
        }

        const runtimeObjective = activeQuest.objectives.find((entry) => entry.id === objective.id);
        if (!runtimeObjective) {
          continue;
        }

        const remaining = runtimeObjective.required - runtimeObjective.progress;
        if (remaining <= 0) {
          continue;
        }

        this.quests.advanceObjective(questData.id, objective.id, Math.min(remaining, progressAmount));

        const updated = this.quests.getQuest(questData.id);
        if (updated?.status === 'completed') {
          this.applyQuestRewards(questData.id);
        }
      }
    }
  }

  public removeItem(itemId: string, amount: number): number {
    return this.inventory.removeItem(itemId, amount);
  }

  public countItem(itemId: string): number {
    return this.inventory.countItem(itemId);
  }

  public spendStamina(amount: number): boolean {
    if (this.stats.stamina < amount) {
      return false;
    }

    this.stats.stamina -= amount;
    return true;
  }

  public regenStamina(delta: number): void {
    const effects = this.perks.getAllEffects();
    const regen = 12 + (effects.staminaRegen ?? 0);
    this.stats.stamina = Math.min(this.stats.maxStamina, this.stats.stamina + regen * delta);
  }

  public receiveDamage(amount: number, blocked: boolean): number {
    const effects = this.perks.getAllEffects();
    const defense = this.stats.defense;
    let outgoing = Math.max(1, amount - Math.floor(defense * 0.25));

    if (blocked) {
      outgoing *= 0.55 - (effects.blockMitigation ?? 0);
      outgoing = Math.max(1, Math.floor(outgoing));
    }

    this.stats.hp = Math.max(0, this.stats.hp - outgoing);

    if (this.stats.hp <= 0) {
      this.log('Warden has fallen.');
    }

    return outgoing;
  }

  public heal(amount: number): void {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
  }

  public restAtCheckpoint(): void {
    this.stats.hp = this.stats.maxHp;
    this.stats.stamina = this.stats.maxStamina;
    this.log('Rested at checkpoint.');
  }

  public awardXp(amount: number): void {
    this.stats.xp += Math.max(0, Math.floor(amount));

    while (this.stats.xp >= this.stats.xpToNext) {
      this.stats.xp -= this.stats.xpToNext;
      this.stats.level += 1;
      this.stats.xpToNext = Math.floor(this.stats.xpToNext * 1.2 + 15);
      this.perks.addPoints(1);
      this.stats.maxHp += 6;
      this.stats.hp = this.stats.maxHp;
      this.stats.maxStamina += 4;
      this.stats.stamina = this.stats.maxStamina;
      this.log(`Level up! Reached ${this.stats.level}.`);
    }

    this.recomputeDerivedStats();
  }

  public addCinders(amount: number): void {
    this.cinders += Math.max(0, Math.floor(amount));
  }

  public spendCinders(amount: number): boolean {
    if (this.cinders < amount) {
      return false;
    }
    this.cinders -= amount;
    return true;
  }

  public getCinders(): number {
    return this.cinders;
  }

  public getAttackPower(base: number): number {
    const effects = this.perks.getAllEffects();
    return base + this.stats.attack + (effects.attack ?? 0) + this.upgrades.weapon * 3;
  }

  public getCritChance(): number {
    const effects = this.perks.getAllEffects();
    return this.stats.crit + (effects.crit ?? 0);
  }

  public getBowBonusDamage(): number {
    const effects = this.perks.getAllEffects();
    return effects.bowDamage ?? 0;
  }

  public getHeavyDamageMultiplier(): number {
    const effects = this.perks.getAllEffects();
    return 1 + (effects.heavyDamageMul ?? 0);
  }

  public getHeavyStaminaDiscount(): number {
    const effects = this.perks.getAllEffects();
    return effects.heavyStaminaDiscount ?? 0;
  }

  public getMoveSpeed(): number {
    return this.stats.moveSpeed;
  }

  public getShopRuntimeState(): ShopRuntimeState {
    return {
      stockByListingId: { ...this.shopState.stockByListingId },
      restockProgress: this.shopState.restockProgress
    };
  }

  public setShopRuntimeState(next: ShopRuntimeState): void {
    this.shopState = {
      stockByListingId: { ...next.stockByListingId },
      restockProgress: next.restockProgress
    };
  }

  public getPerkEffect(effectId: string): number {
    return this.perks.getAllEffects()[effectId] ?? 0;
  }

  public startQuest(questId: string): void {
    const quest = this.quests.getQuest(questId);
    if (!quest || quest.status !== 'available') {
      return;
    }
    this.quests.startQuest(questId);
    this.log(`Quest started: ${this.questDisplayIndex.get(questId)?.title ?? questId}.`);
  }

  public completeQuest(questId: string): void {
    const quest = this.quests.getQuest(questId);
    if (!quest || quest.status !== 'active') {
      return;
    }

    for (const objective of quest.objectives) {
      if (objective.progress < objective.required) {
        this.quests.advanceObjective(questId, objective.id, objective.required - objective.progress);
      }
    }

    this.applyQuestRewards(questId);
  }

  public advanceQuestObjective(questId: string, objectiveId: string, amount = 1): void {
    const quest = this.quests.getQuest(questId);
    if (!quest || quest.status !== 'active') {
      return;
    }

    this.quests.advanceObjective(questId, objectiveId, amount);

    const after = this.quests.getQuest(questId);
    if (after?.status === 'completed') {
      this.applyQuestRewards(questId);
    }
  }

  public getQuestStatus(questId: string): QuestStatus | undefined {
    return this.quests.getQuest(questId)?.status;
  }

  public getQuestEntries(): QuestUiEntry[] {
    const entries: QuestUiEntry[] = [];

    for (const [questId, descriptor] of this.questDisplayIndex.entries()) {
      const instance = this.quests.getQuest(questId);
      if (!instance) {
        continue;
      }

      entries.push({
        id: questId,
        title: descriptor.title,
        status: instance.status,
        objectives: instance.objectives.map((objective, index) => ({
          id: objective.id,
          description: descriptor.objectives[index]?.description ?? objective.id,
          progress: objective.progress,
          required: objective.required
        }))
      });
    }

    return entries;
  }

  public getInventoryEntries(): InventoryUiEntry[] {
    return this.inventory.getSlots().map((slot, index) => ({
      index,
      itemId: slot?.itemId ?? null,
      amount: slot?.amount ?? 0,
      tags: slot?.tags ?? []
    }));
  }

  public getDialogue(conversationId: string): DialogueData | undefined {
    return this.dialoguesById.get(conversationId);
  }

  public getQuestHint(): string {
    const quest = this.getQuestEntries().find((entry) => entry.status === 'active') ??
      this.getQuestEntries().find((entry) => entry.status === 'available');

    if (!quest) {
      return 'No active objectives. Explore Cinderhaven for leads.';
    }

    const objective = quest.objectives.find((entry) => entry.progress < entry.required) ?? quest.objectives[0];
    return `${quest.title}: ${objective.description} (${objective.progress}/${objective.required})`;
  }

  public applyReward(reward: RewardPackage): void {
    if (reward.cinders) {
      this.addCinders(reward.cinders);
    }

    if (reward.xp) {
      this.awardXp(reward.xp);
    }

    for (const [factionId, amount] of Object.entries(reward.reputation ?? {})) {
      this.addReputation(factionId as FactionId, amount ?? 0);
    }

    for (const item of reward.items ?? []) {
      this.addItem(item.itemId, item.amount, item.maxStack);
    }
  }

  public log(message: string): void {
    this.eventLog.unshift(message);
    this.eventLog.splice(8);
  }

  public getEvents(): string[] {
    return [...this.eventLog];
  }

  public getHudViewModel(): HudViewModel {
    return {
      hp: Math.round(this.stats.hp),
      maxHp: this.stats.maxHp,
      stamina: Math.round(this.stats.stamina),
      maxStamina: this.stats.maxStamina,
      level: this.stats.level,
      xp: this.stats.xp,
      xpToNext: this.stats.xpToNext,
      cinders: this.cinders,
      activeWeaponMode: this.equipment.weaponMode,
      questHint: this.getQuestHint(),
      events: this.getEvents(),
      quickbar: this.buildQuickbarLabels()
    };
  }

  public serialize(): SessionSnapshot {
    return {
      player: { ...this.stats },
      cinders: this.cinders,
      equipment: { ...this.equipment, trinkets: [...this.equipment.trinkets] as [string | null, string | null] },
      inventory: this.inventory.serialize(),
      quests: this.quests.serialize(),
      worldFlags: { ...this.flags },
      reputations: { ...this.reputations },
      perks: this.perks.serialize(),
      regions: this.getRegions(),
      upgrades: this.getEquipmentUpgrades(),
      shop: this.getShopRuntimeState(),
      eventLog: this.getEvents(),
      timestamp: new Date().toISOString()
    };
  }

  private buildQuickbarLabels(): string[] {
    return this.inventory.getQuickbar().map((slotIndex, index) => {
      if (slotIndex === null) {
        return `${index + 1}: --`;
      }

      const slot = this.inventory.getSlots()[slotIndex];
      if (!slot) {
        return `${index + 1}: --`;
      }

      const item = this.itemsById.get(slot.itemId);
      const name = item?.name ?? slot.itemId;
      return `${index + 1}: ${name} x${slot.amount}`;
    });
  }

  private loadContentIndexes(): void {
    for (const item of defaultContent.items as ItemData[]) {
      this.itemsById.set(item.id, item);
    }

    for (const quest of defaultContent.quests as QuestData[]) {
      const objectives = quest.objectives.map((objective) => ({
        id: objective.id,
        description: `${objective.type.toUpperCase()}: ${objective.targetId}`,
        required: objective.required
      }));

      this.questDisplayIndex.set(quest.id, {
        title: quest.title,
        objectives
      });
    }

    for (const dialogue of defaultContent.dialogues as DialogueData[]) {
      this.dialoguesById.set(dialogue.conversationId, dialogue);
    }
  }

  private initializeQuests(): void {
    for (const quest of defaultContent.quests as QuestData[]) {
      this.quests.registerQuest({
        id: quest.id,
        title: quest.title,
        objectives: quest.objectives.map((objective) => ({
          id: objective.id,
          description: `${objective.type}: ${objective.targetId}`,
          required: objective.required
        })),
        prerequisites: {
          flags: (quest.prerequisites?.flags ?? []).map((entry) => ({ id: entry.id, equals: entry.equals })),
          questsCompleted: quest.prerequisites?.quests ?? []
        }
      });
    }
  }

  private syncQuestFlagsFromWorldFlags(): void {
    for (const [flagId, value] of Object.entries(this.flags)) {
      if (typeof value === 'boolean') {
        this.quests.setFlag(flagId, value);
      }
    }
  }

  private applyQuestRewards(questId: string): void {
    const questData = (defaultContent.quests as QuestData[]).find((entry) => entry.id === questId);
    if (!questData) {
      return;
    }

    this.applyReward({
      cinders: questData.rewards.cinders,
      xp: questData.rewards.xp,
      reputation: Object.fromEntries(
        questData.rewards.reputation.map((entry) => [entry.factionId, entry.amount])
      ) as Partial<Record<FactionId, number>>,
      items: questData.rewards.items.map((item) => ({ itemId: item.itemId, amount: item.amount }))
    });

    for (const flag of questData.onComplete?.setFlags ?? []) {
      this.setFlag(flag.id, flag.value);
      if (flag.id.endsWith('_unlocked') && flag.value) {
        const region = flag.id.replace('gate_', '').replace('_unlocked', '');
        this.unlockRegion(region);
      }
    }

    for (const region of questData.onComplete?.unlockRegions ?? []) {
      this.unlockRegion(region);
    }

    this.log(`Quest complete: ${questData.title}.`);
  }

  private recomputeDerivedStats(): void {
    const effects = this.perks.getAllEffects();
    const base = { ...this.stats };

    this.stats.maxStamina = Math.max(30, BASE_PLAYER.maxStamina + (this.stats.level - 1) * 4 + (effects.maxStamina ?? 0));
    this.stats.stamina = Math.min(this.stats.stamina, this.stats.maxStamina);
    this.stats.attack = BASE_PLAYER.attack + (this.stats.level - 1) * 2 + (effects.attack ?? 0);
    this.stats.defense =
      BASE_PLAYER.defense + Math.floor((this.stats.level - 1) / 2) + (effects.defense ?? 0) + this.upgrades.armor * 2;
    this.stats.crit = BASE_PLAYER.crit + (effects.crit ?? 0);
    this.stats.moveSpeed = BASE_PLAYER.moveSpeed;

    if (base.maxStamina !== this.stats.maxStamina) {
      this.log(`Stamina capacity adjusted to ${this.stats.maxStamina}.`);
    }
  }

  private seedStartingInventory(): void {
    this.addItem('consumable_heal_small', 4);
    this.addItem('material_cloudleaf', 6);
    this.addItem('material_iron_ore', 8);
    this.addItem('key_anchor_dust', 1);

    this.inventory.assignQuickbar(0, this.findSlot('consumable_heal_small'));
    this.inventory.assignQuickbar(1, this.findSlot('material_iron_ore'));
    this.inventory.assignQuickbar(2, this.findSlot('material_cloudleaf'));
  }

  private findSlot(itemId: string): number | null {
    const slots = this.inventory.getSlots();
    for (let i = 0; i < slots.length; i += 1) {
      if (slots[i]?.itemId === itemId) {
        return i;
      }
    }
    return null;
  }

  private inferTags(itemId: string): Array<'quest' | 'material' | 'consumable' | 'gear' | 'key'> {
    const item = this.itemsById.get(itemId);
    if (!item) {
      return ['material'];
    }

    if (item.type === 'quest') {
      return ['quest'];
    }
    if (item.type === 'consumable') {
      return ['consumable'];
    }
    if (item.type === 'material') {
      return ['material'];
    }
    if (item.type === 'key') {
      return ['key'];
    }

    return ['gear'];
  }
}
