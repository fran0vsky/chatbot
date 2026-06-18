/**
 * Curated list of OpenRouter models available for user-created custom dinos.
 *
 * Only free / low-cost models from the built-in dino registry are included.
 * Paid models (e.g. google/gemini-2.5-flash-image used by Vinci) are excluded
 * so users cannot inadvertently trigger expensive requests.
 *
 * This is the single source of truth — CustomDinoService validates incoming
 * model ids against this list, and the /api/models endpoint exposes it to the
 * creation form.
 */

import { CuratedModel } from '@org/shared-types';

export const MODEL_CATALOGUE: CuratedModel[] = [
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    label: 'Llama 3.3 70B Instruct (free)',
  },
  {
    id: 'openai/gpt-oss-20b:free',
    label: 'GPT-OSS 20B (free)',
  },
  {
    id: 'openai/gpt-oss-120b:free',
    label: 'GPT-OSS 120B (free)',
  },
  {
    id: 'nvidia/nemotron-3-nano-30b-a3b:free',
    label: 'Nvidia Nemotron Nano 30B (free)',
  },
  {
    id: 'nvidia/nemotron-nano-12b-v2-vl:free',
    label: 'Nvidia Nemotron Nano 12B VL (free)',
  },
];

/** Set of allowed model ids for O(1) lookup. */
const ALLOWED_MODEL_IDS = new Set<string>(MODEL_CATALOGUE.map((m) => m.id));

/**
 * Returns true only when `id` is in the curated model catalogue.
 * Used by CustomDinoService to validate create/update requests.
 */
export function isAllowedModel(id: string): boolean {
  return ALLOWED_MODEL_IDS.has(id);
}
