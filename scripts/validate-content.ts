import { defaultContent } from '../src/game/content/defaultContent';
import { validateContent } from '../src/game/content/validateContent';

const result = validateContent(defaultContent);

if (!result.ok) {
  console.error('Content validation failed:');
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Content validation passed: ${result.parsed?.items.length ?? 0} items, ${result.parsed?.enemies.length ?? 0} enemies, ${result.parsed?.quests.length ?? 0} quests, ${result.parsed?.dialogues.length ?? 0} dialogues.`
);
