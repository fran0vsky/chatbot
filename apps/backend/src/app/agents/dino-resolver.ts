import { CustomDino, Dino } from '@org/shared-types';
import { getDino } from './dinos';
import { CustomDinoService } from './custom-dinos.service';

const CUSTOM_PREFIX = 'custom:';

/**
 * Map a persisted CustomDino row (with the `custom:` prefix id) to the `Dino`
 * shape expected by the agent loop. The mapped `toolNames` are the persisted
 * (already catalogue-validated) names; `resolveActiveTools` still intersects
 * them with the live catalogue at chat time. `imageGen` is false — custom dinos
 * are not image-gen in this phase. (D-02)
 */
export function customDinoToDino(custom: CustomDino): Dino {
  return {
    id: custom.id,
    name: custom.name,
    species: custom.species ?? '',
    persona: custom.persona ?? '',
    blurb: custom.blurb ?? '',
    specialty: 'Custom dino',
    model: custom.model,
    systemPrompt: custom.systemPrompt,
    toolNames: custom.toolNames,
    accent: custom.accent,
    avatarUrl: custom.avatarUrl,
    imageGen: false,
  };
}

/**
 * Async resolver that covers both built-in and user-authored custom dinos (D-01).
 *
 *  - `id` is undefined               → undefined (no dino)
 *  - `id` starts with `'custom:'`    → DB lookup via CustomDinoService.getById, scoped
 *                                       by userId; maps to Dino via customDinoToDino.
 *                                       A missing / unauthorised custom id → undefined
 *                                       (NOT a silent fallback to the default built-in —
 *                                       a missing custom dino must not impersonate Rexford).
 *  - anything else                   → synchronous getDino() from the built-in registry.
 */
export async function resolveDino(
  id: string | undefined,
  userId: string | undefined,
  customDinoService: CustomDinoService,
): Promise<Dino | undefined> {
  if (!id) return undefined;

  if (id.startsWith(CUSTOM_PREFIX)) {
    const custom = await customDinoService.getById(id, userId);
    return custom ? customDinoToDino(custom) : undefined;
  }

  return getDino(id);
}
