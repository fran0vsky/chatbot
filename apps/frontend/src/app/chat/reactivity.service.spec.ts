import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { DinoReactivityMap } from '@org/shared-types';
import { ReactivityService } from './reactivity.service';
import { environment } from '../../environments/environment';

describe('ReactivityService', () => {
  let service: ReactivityService;
  let httpMock: HttpTestingController;

  const BASE = `${environment.apiUrl}/api`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReactivityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ─── Initial state ────────────────────────────────────────────────────────

  it('starts with an empty levels map', () => {
    expect(service.levels()).toEqual({});
  });

  // ─── load() ───────────────────────────────────────────────────────────────

  it('load() issues GET /dino-reactivity with userId param', () => {
    service.load();
    const req = httpMock.expectOne((r) =>
      r.url === `${BASE}/dino-reactivity` && r.params.has('userId'),
    );
    expect(req.request.method).toBe('GET');
    req.flush({ levels: {} });
  });

  it('load() populates the levels signal from the response', () => {
    const storedLevels: DinoReactivityMap = {
      rexford: 'chatty',
      nimbus: 'never',
    };

    service.load();
    const req = httpMock.expectOne((r) =>
      r.url === `${BASE}/dino-reactivity`,
    );
    req.flush({ levels: storedLevels });

    expect(service.levels()).toEqual(storedLevels);
  });

  it('load() keeps existing signal value on HTTP error (non-blocking)', () => {
    service.load();
    const req = httpMock.expectOne((r) =>
      r.url === `${BASE}/dino-reactivity`,
    );
    req.flush('error', { status: 500, statusText: 'Server Error' });

    // Should still be the default empty map; no throw
    expect(service.levels()).toEqual({});
  });

  // ─── setLevel() ───────────────────────────────────────────────────────────

  it('setLevel() optimistically updates the levels signal before the response', () => {
    service.setLevel('rexford', 'chatty');

    // Signal updated immediately
    expect(service.levels()['rexford']).toBe('chatty');

    // Flush the pending PUT
    const req = httpMock.expectOne((r) =>
      r.url === `${BASE}/dino-reactivity/rexford`,
    );
    req.flush({ dinoId: 'rexford', level: 'chatty' });
  });

  it('setLevel() issues PUT to /dino-reactivity/:dinoId with userId + level in body', () => {
    service.setLevel('nimbus', 'rarely');

    const req = httpMock.expectOne((r) =>
      r.url === `${BASE}/dino-reactivity/nimbus`,
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.level).toBe('rarely');
    expect(req.request.body.userId).toBeTruthy();
    req.flush({ dinoId: 'nimbus', level: 'rarely' });
  });

  it('setLevel() keeps the optimistic value on PUT error (degraded mode)', () => {
    service.setLevel('rexford', 'chatty');
    expect(service.levels()['rexford']).toBe('chatty'); // optimistic

    const req = httpMock.expectOne((r) =>
      r.url === `${BASE}/dino-reactivity/rexford`,
    );
    req.flush('error', { status: 500, statusText: 'Server Error' });

    // Optimistic value retained after error
    expect(service.levels()['rexford']).toBe('chatty');
  });

  it('setLevel() merges into existing levels without overwriting others', () => {
    service.setLevel('rexford', 'chatty');
    const req1 = httpMock.expectOne((r) =>
      r.url === `${BASE}/dino-reactivity/rexford`,
    );
    req1.flush({ dinoId: 'rexford', level: 'chatty' });

    service.setLevel('nimbus', 'never');
    const req2 = httpMock.expectOne((r) =>
      r.url === `${BASE}/dino-reactivity/nimbus`,
    );
    req2.flush({ dinoId: 'nimbus', level: 'never' });

    expect(service.levels()).toEqual({ rexford: 'chatty', nimbus: 'never' });
  });
});
