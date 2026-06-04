import { Body, Controller, Post } from '@nestjs/common';
import {
  AssistantInterpretRequest,
  AssistantInterpretResponse,
} from '@org/shared-types';
import { AssistantService } from './assistant.service';

/**
 * Voice Dino Assistant (Phase 29).
 *
 * POST /api/assistant/interpret — turn a spoken command into a whitelisted
 * action, a clarifying question, or a refusal. The frontend re-validates any
 * action through the catalogue safety gate before dispatching.
 */
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('interpret')
  async interpret(
    @Body() body: AssistantInterpretRequest,
  ): Promise<AssistantInterpretResponse> {
    const decision = await this.assistantService.interpret(body ?? ({} as AssistantInterpretRequest));
    return { decision };
  }
}
