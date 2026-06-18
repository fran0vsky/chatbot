import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AvatarService } from './avatar.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal fake Express.Multer.File for testing validation paths. */
function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.alloc(1024),
    stream: null as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: graceful degradation — AVATAR_BUCKET unset
// ---------------------------------------------------------------------------

describe('AvatarService — graceful degradation (AVATAR_BUCKET unset)', () => {
  let svc: AvatarService;
  let originalBucket: string | undefined;

  beforeEach(() => {
    svc = new AvatarService();
    originalBucket = process.env['AVATAR_BUCKET'];
    // Ensure the bucket env is absent
    delete process.env['AVATAR_BUCKET'];
  });

  afterEach(() => {
    if (originalBucket !== undefined) {
      process.env['AVATAR_BUCKET'] = originalBucket;
    } else {
      delete process.env['AVATAR_BUCKET'];
    }
  });

  it('throws BadRequestException("avatar upload is not configured") when AVATAR_BUCKET is unset', async () => {
    const file = makeFile();
    await expect(svc.upload(file)).rejects.toMatchObject({
      message: 'avatar upload is not configured',
    });
  });

  it('throws BadRequestException even when no file is supplied', async () => {
    // AVATAR_BUCKET check fires before the file-presence check
    await expect(svc.upload(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// Tests: validation — AVATAR_BUCKET set, validation paths exercised
// ---------------------------------------------------------------------------

describe('AvatarService — validation (AVATAR_BUCKET set, no real GCS call)', () => {
  let svc: AvatarService;
  let originalBucket: string | undefined;

  beforeEach(() => {
    svc = new AvatarService();
    originalBucket = process.env['AVATAR_BUCKET'];
    // Set a dummy bucket so the degradation guard passes
    process.env['AVATAR_BUCKET'] = 'test-avatars-bucket';
  });

  afterEach(() => {
    if (originalBucket !== undefined) {
      process.env['AVATAR_BUCKET'] = originalBucket;
    } else {
      delete process.env['AVATAR_BUCKET'];
    }
  });

  it('throws BadRequestException("no file was uploaded") when file is undefined', async () => {
    await expect(svc.upload(undefined)).rejects.toMatchObject({
      message: 'no file was uploaded',
    });
  });

  it('throws BadRequestException for a non-image/* mimetype', async () => {
    const file = makeFile({ mimetype: 'application/pdf', originalname: 'doc.pdf' });
    await expect(svc.upload(file)).rejects.toMatchObject({
      message: expect.stringContaining('application/pdf'),
    });
  });

  it('throws BadRequestException for a text/* mimetype', async () => {
    const file = makeFile({ mimetype: 'text/plain', originalname: 'note.txt' });
    await expect(svc.upload(file)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequestException when file size exceeds 2 MB', async () => {
    const oversizeBytes = 2 * 1024 * 1024 + 1; // 1 byte over the cap
    const file = makeFile({
      size: oversizeBytes,
      buffer: Buffer.alloc(oversizeBytes),
    });
    await expect(svc.upload(file)).rejects.toMatchObject({
      message: expect.stringContaining('2 MB limit'),
    });
  });

  it('does NOT throw for a 2 MB file that is exactly at the limit (GCS call expected, but no network)', async () => {
    // At exactly 2 MB the size check must pass; the subsequent GCS call will fail
    // because Storage() will error in the test environment — but the test confirms
    // the validation branches are traversed without throwing a 400.
    const exactSize = 2 * 1024 * 1024;
    const file = makeFile({
      size: exactSize,
      mimetype: 'image/jpeg',
      buffer: Buffer.alloc(exactSize),
    });
    // We only assert this is NOT a BadRequestException from validation.
    // It WILL reject (either GCS error or our "upload failed" 400) but not
    // from the size-cap guard.
    const result = svc.upload(file);
    await expect(result).rejects.toBeDefined();
    try {
      await result;
    } catch (err) {
      // Must NOT be the size-related message
      if (err instanceof BadRequestException) {
        expect(err.message).not.toContain('2 MB limit');
      }
    }
  });
});
