import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { DinoSummary } from '@org/shared-types';
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

  it('loads the roster via HttpClient and exposes it as a signal', () => {
    service.loadDinos();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/dinos`);
    expect(req.request.method).toBe('GET');
    req.flush(SAMPLE);

    expect(service.dinos()).toEqual(SAMPLE);
    expect(service.loaded()).toBe(true);
    expect(service.getById('rexford')?.name).toBe('Rexford');
  });

  it('falls back to an empty roster on HTTP error without throwing', () => {
    service.loadDinos();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/dinos`);
    req.flush('boom', { status: 500, statusText: 'Server Error' });

    expect(service.dinos()).toEqual([]);
    expect(service.loaded()).toBe(true);
    expect(service.getById('rexford')).toBeUndefined();
  });

  it('getById returns undefined for an undefined id', () => {
    expect(service.getById(undefined)).toBeUndefined();
  });
});
