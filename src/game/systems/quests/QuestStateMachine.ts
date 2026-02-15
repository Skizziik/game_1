export type QuestStatus = 'locked' | 'available' | 'active' | 'completed' | 'failed';

export interface QuestObjective {
  id: string;
  description: string;
  required: number;
}

export interface QuestPrerequisites {
  flags?: Array<{ id: string; equals: boolean }>;
  questsCompleted?: string[];
}

export interface QuestDefinition {
  id: string;
  title: string;
  objectives: QuestObjective[];
  prerequisites?: QuestPrerequisites;
}

export interface QuestInstance {
  id: string;
  status: QuestStatus;
  objectives: Array<QuestObjective & { progress: number }>;
}

export interface SerializedQuestState {
  quests: QuestInstance[];
  flags: Record<string, boolean>;
}

export class QuestStateMachine {
  private readonly definitions = new Map<string, QuestDefinition>();
  private readonly instances = new Map<string, QuestInstance>();
  private readonly flags: Record<string, boolean> = {};

  public static fromSerialized(input: SerializedQuestState): QuestStateMachine {
    const machine = new QuestStateMachine();
    for (const quest of input.quests) {
      machine.instances.set(quest.id, {
        ...quest,
        objectives: quest.objectives.map((objective) => ({ ...objective }))
      });
    }
    Object.assign(machine.flags, input.flags);
    return machine;
  }

  public registerQuest(definition: QuestDefinition): void {
    this.definitions.set(definition.id, definition);

    if (!this.instances.has(definition.id)) {
      this.instances.set(definition.id, {
        id: definition.id,
        status: 'locked',
        objectives: definition.objectives.map((objective) => ({ ...objective, progress: 0 }))
      });
    }
  }

  public setFlag(id: string, value: boolean): void {
    this.flags[id] = value;
  }

  public getFlag(id: string): boolean {
    return this.flags[id] ?? false;
  }

  public syncAvailability(): void {
    for (const [questId, definition] of this.definitions.entries()) {
      const quest = this.instances.get(questId);
      if (!quest || quest.status !== 'locked') {
        continue;
      }

      if (this.prerequisitesMet(definition.prerequisites)) {
        quest.status = 'available';
      }
    }
  }

  public startQuest(id: string): void {
    const quest = this.requireQuest(id);
    if (quest.status !== 'available') {
      throw new Error(`Quest ${id} is not available`);
    }
    quest.status = 'active';
  }

  public advanceObjective(id: string, objectiveId: string, amount = 1): void {
    const quest = this.requireQuest(id);
    if (quest.status !== 'active') {
      throw new Error(`Quest ${id} is not active`);
    }

    const objective = quest.objectives.find((entry) => entry.id === objectiveId);
    if (!objective) {
      throw new Error(`Quest ${id} has no objective ${objectiveId}`);
    }

    objective.progress = Math.min(objective.required, objective.progress + amount);

    if (quest.objectives.every((entry) => entry.progress >= entry.required)) {
      quest.status = 'completed';
    }
  }

  public failQuest(id: string): void {
    const quest = this.requireQuest(id);
    if (quest.status === 'completed') {
      throw new Error(`Quest ${id} is already completed`);
    }
    quest.status = 'failed';
  }

  public getQuest(id: string): QuestInstance | undefined {
    const quest = this.instances.get(id);
    return quest
      ? {
          ...quest,
          objectives: quest.objectives.map((objective) => ({ ...objective }))
        }
      : undefined;
  }

  public serialize(): SerializedQuestState {
    return {
      quests: [...this.instances.values()].map((quest) => ({
        ...quest,
        objectives: quest.objectives.map((objective) => ({ ...objective }))
      })),
      flags: { ...this.flags }
    };
  }

  private prerequisitesMet(prerequisites: QuestPrerequisites | undefined): boolean {
    if (!prerequisites) {
      return true;
    }

    const flagsMet =
      prerequisites.flags?.every((entry) => {
        return this.getFlag(entry.id) === entry.equals;
      }) ?? true;

    const completedMet =
      prerequisites.questsCompleted?.every((questId) => {
        const quest = this.instances.get(questId);
        return quest?.status === 'completed';
      }) ?? true;

    return flagsMet && completedMet;
  }

  private requireQuest(id: string): QuestInstance {
    const quest = this.instances.get(id);
    if (!quest) {
      throw new Error(`Quest ${id} does not exist`);
    }
    return quest;
  }
}
