import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AvatarService } from './avatar.service';

/**
 * Thin controller for avatar image upload.
 *
 * Route: POST /api/custom-dinos/avatar (via global /api prefix + controller path)
 * All validation + GCS interaction lives in AvatarService (thin controller rule).
 */
@Controller('custom-dinos')
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File): Promise<{ url: string }> {
    return this.avatarService.upload(file);
  }
}
