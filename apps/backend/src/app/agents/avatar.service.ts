import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Storage, SaveOptions } from '@google-cloud/storage';
import { randomUUID } from 'crypto';

/** Maximum allowed avatar file size: 2 MB. */
const MAX_SIZE = 2 * 1024 * 1024;

/** Derive file extension from a validated image/* mimetype. */
function extFromMimetype(mimetype: string): string {
  const sub = mimetype.split('/')[1] ?? '';
  switch (sub) {
    case 'jpeg':
    case 'jpg':
      return 'jpg';
    case 'png':
      return 'png';
    case 'gif':
      return 'gif';
    case 'webp':
      return 'webp';
    default:
      return 'png';
  }
}

/**
 * AvatarService — validates and uploads an avatar image to a public-read GCS bucket.
 *
 * Design decisions (42-02):
 *   D-03: validation before any GCS interaction (mimetype, size, presence)
 *   D-04: object path = avatars/<uuid>.<ext>, public URL = storage.googleapis.com/<bucket>/...
 *   D-05: lazy Storage construction + graceful degradation when AVATAR_BUCKET is unset
 *
 * Application Default Credentials are picked up automatically from the VM's --scopes=cloud-platform.
 * No key file is required (T-42-02-03).
 */
@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

  async upload(file: Express.Multer.File | undefined): Promise<{ url: string }> {
    // ── Graceful degradation: AVATAR_BUCKET must be configured (D-05, T-42-02-04) ──
    const bucket = process.env['AVATAR_BUCKET'];
    if (!bucket) {
      throw new BadRequestException('avatar upload is not configured');
    }

    // ── Validate presence ──
    if (!file) {
      throw new BadRequestException('no file was uploaded');
    }

    // ── Validate mimetype (D-03, T-42-02-01) ──
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException(
        `file type '${file.mimetype}' is not allowed; only image/* is accepted`,
      );
    }

    // ── Validate size (D-03, T-42-02-01) ──
    if (file.size > MAX_SIZE) {
      throw new BadRequestException(
        `file size ${file.size} bytes exceeds the 2 MB limit`,
      );
    }

    // ── Upload to GCS (lazy client — never instantiated at module load, D-05) ──
    const storage = new Storage();
    const ext = extFromMimetype(file.mimetype);
    const objectName = `avatars/${randomUUID()}.${ext}`;

    const saveOptions: SaveOptions = {
      contentType: file.mimetype,
    };

    try {
      await storage.bucket(bucket).file(objectName).save(file.buffer, saveOptions);
    } catch (err) {
      this.logger.error(
        `GCS upload failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('avatar upload failed; please try again later');
    }

    const url = `https://storage.googleapis.com/${bucket}/${objectName}`;
    this.logger.log(`Avatar uploaded: ${url}`);
    return { url };
  }
}
