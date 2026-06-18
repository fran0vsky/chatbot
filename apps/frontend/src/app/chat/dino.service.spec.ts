import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  CuratedModel,
  CustomDino,
  DinoSummary,
} from '@org/shared-types';
import { DinoService } from './dino.service';
import { environment } from '../../environments/environment';

const SAMPLE: DinoSummary[] = [
  {
    id: 'rexford',
    name: 'Rexford',
    species: 'Tyrannosaurus',
    persona: 'Blunt and fast',
    blurb: 'Gets to the point.',
    specialty: 'Fast factual answers',
    model: 'openai/gpt-oss-120b:free',
    toolNames: ['web_search'],
  },
];

const CUSTOM_DINO: CustomDino = {
  id: 'custom:abc-123',
  userId: 'test-user',
  name: 'My Dino',
  systemPrompt: 'Be helpful.',
  model: 'openai/gpt-oss-20b:free',
  toolNames: ['web_search'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MODELS: CuratedModel[] = [
  { id: 'openai/gpt-oss-120b:free', label: 'GPT-OSS 120B (Free)' },
  { id: 'openai/gpt-oss-20b:free', label: 'GPT-OSS 20B (Free)' },
];

describe('DinoService', () => {
  let service: DinoService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DinoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ─── Roster fetch (userId-scoped) ─────────────────────────────────────────

  it('fetchDinos hits /api/dinos with a userId param', () => {
    service.fetchDinos().subscribe();
    const req = httpMock.expectOne((r) =>
      r.url === `${environment.apiUrl}/api/dinos` && r.params.has('userId'),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('userId')).toBeTruthy();
    req.flush(SAMPLE);
  });

  it('loadDinos sets the roster signal and includes userId', () => {
    service.loadDinos();
    const req = httpMock.expectOne((r) =>
      r.url === `${environment.apiUrl}/api/dinos` && r.params.has('userId'),
    );
    expect(req.request.method).toBe('GET');
    req.flush(SAMPLE);

    expect(service.dinos()).toEqual(SAMPLE);
    expect(service.loaded()).toBe(true);
    expect(service.getById('rexford')?.name).toBe('Rexford');
  });

  it('falls back to an empty roster on HTTP error without throwing', () => {
    service.loadDinos();
    const req = httpMock.expectOne((r) =>
      r.url === `${environment.apiUrl}/api/dinos`,
    );
    req.flush('boom', { status: 500, statusText: 'Server Error' });

    expect(service.dinos()).toEqual([]);
    expect(service.loaded()).toBe(true);
    expect(service.getById('rexford')).toBeUndefined();
  });

  it('getById returns undefined for an undefined id', () => {
    expect(service.getById(undefined)).toBeUndefined();
  });

  // ─── fetchModels ──────────────────────────────────────────────────────────

  it('fetchModels hits GET /api/models', () => {
    service.fetchModels().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/models`);
    expect(req.request.method).toBe('GET');
    req.flush(MODELS);
  });

  // ─── uploadAvatar ─────────────────────────────────────────────────────────

  it('uploadAvatar POSTs FormData to /api/custom-dinos/avatar', () => {
    const file = new File(['img'], 'avatar.png', { type: 'image/png' });
    service.uploadAvatar(file).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/custom-dinos/avatar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);
    req.flush({ url: 'https://example.com/avatar.png' });
  });

  // ─── createCustomDino ─────────────────────────────────────────────────────

  it('createCustomDino POSTs to /api/custom-dinos with userId merged in body', () => {
    service
      .createCustomDino({
        name: 'My Dino',
        systemPrompt: 'Be helpful.',
        model: 'openai/gpt-oss-20b:free',
        toolNames: ['web_search'],
      })
      .subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/custom-dinos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.name).toBe('My Dino');
    expect(req.request.body.userId).toBeTruthy();
    req.flush(CUSTOM_DINO);
  });

  // ─── updateCustomDino ─────────────────────────────────────────────────────

  it('updateCustomDino sends PUT with userId as query param', () => {
    service
      .updateCustomDino('custom:abc-123', { name: 'Updated Name' })
      .subscribe();

    const req = httpMock.expectOne((r) =>
      r.url === `${environment.apiUrl}/api/custom-dinos/custom:abc-123` &&
      r.params.has('userId'),
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.name).toBe('Updated Name');
    expect(req.request.params.get('userId')).toBeTruthy();
    req.flush(CUSTOM_DINO);
  });

  // ─── deleteCustomDino ─────────────────────────────────────────────────────

  it('deleteCustomDino sends DELETE with userId as query param', () => {
    service.deleteCustomDino('custom:abc-123').subscribe();

    const req = httpMock.expectOne((r) =>
      r.url === `${environment.apiUrl}/api/custom-dinos/custom:abc-123` &&
      r.params.has('userId'),
    );
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('userId')).toBeTruthy();
    req.flush(null);
  });
});
