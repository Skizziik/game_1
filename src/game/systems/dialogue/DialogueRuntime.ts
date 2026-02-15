import type { QuestStatus } from '../quests/QuestStateMachine';

export type DialogueCondition =
  | { type: 'flagEquals'; flagId: string; equals: string | number | boolean }
  | { type: 'statAtLeast'; statId: string; value: number }
  | { type: 'itemCountAtLeast'; itemId: string; value: number }
  | { type: 'reputationAtLeast'; factionId: string; value: number }
  | { type: 'questStatus'; questId: string; status: QuestStatus };

export type DialogueEffect =
  | { type: 'setFlag'; flagId: string; value: string | number | boolean }
  | { type: 'addReputation'; factionId: string; value: number }
  | { type: 'addItem'; itemId: string; amount: number }
  | { type: 'startQuest'; questId: string }
  | { type: 'completeQuest'; questId: string };

export interface DialogueChoice {
  id: string;
  text: string;
  nextNodeId: string;
  conditions?: DialogueCondition[];
  effects?: DialogueEffect[];
}

export interface DialogueNode {
  id: string;
  speakerId: string;
  text: string;
  choices: DialogueChoice[];
}

export interface DialogueConversation {
  conversationId: string;
  nodes: DialogueNode[];
}

export interface DialogueStateAccess {
  getFlag(flagId: string): string | number | boolean | undefined;
  setFlag(flagId: string, value: string | number | boolean): void;
  getStat(statId: string): number;
  getItemCount(itemId: string): number;
  addItem(itemId: string, amount: number): void;
  getReputation(factionId: string): number;
  addReputation(factionId: string, amount: number): void;
  getQuestStatus(questId: string): QuestStatus | undefined;
  startQuest(questId: string): void;
  completeQuest(questId: string): void;
}

export class DialogueRuntime {
  private readonly nodeById: Map<string, DialogueNode>;

  public constructor(
    private readonly conversation: DialogueConversation,
    private readonly state: DialogueStateAccess
  ) {
    this.nodeById = new Map(conversation.nodes.map((node) => [node.id, node]));
  }

  public getNode(nodeId: string): DialogueNode {
    const node = this.nodeById.get(nodeId);
    if (!node) {
      throw new Error(`Dialogue node ${nodeId} not found`);
    }
    return node;
  }

  public getAvailableChoices(nodeId: string): DialogueChoice[] {
    const node = this.getNode(nodeId);
    return node.choices.filter((choice) => this.conditionsMet(choice.conditions ?? []));
  }

  public applyChoice(choice: DialogueChoice): string {
    for (const effect of choice.effects ?? []) {
      this.applyEffect(effect);
    }

    if (!this.nodeById.has(choice.nextNodeId)) {
      throw new Error(`Dialogue choice points to missing node ${choice.nextNodeId}`);
    }

    return choice.nextNodeId;
  }

  private conditionsMet(conditions: DialogueCondition[]): boolean {
    return conditions.every((condition) => {
      switch (condition.type) {
        case 'flagEquals':
          return this.state.getFlag(condition.flagId) === condition.equals;
        case 'statAtLeast':
          return this.state.getStat(condition.statId) >= condition.value;
        case 'itemCountAtLeast':
          return this.state.getItemCount(condition.itemId) >= condition.value;
        case 'reputationAtLeast':
          return this.state.getReputation(condition.factionId) >= condition.value;
        case 'questStatus':
          return this.state.getQuestStatus(condition.questId) === condition.status;
        default:
          return false;
      }
    });
  }

  private applyEffect(effect: DialogueEffect): void {
    switch (effect.type) {
      case 'setFlag':
        this.state.setFlag(effect.flagId, effect.value);
        break;
      case 'addReputation':
        this.state.addReputation(effect.factionId, effect.value);
        break;
      case 'addItem':
        this.state.addItem(effect.itemId, effect.amount);
        break;
      case 'startQuest':
        this.state.startQuest(effect.questId);
        break;
      case 'completeQuest':
        this.state.completeQuest(effect.questId);
        break;
      default:
        break;
    }
  }
}
