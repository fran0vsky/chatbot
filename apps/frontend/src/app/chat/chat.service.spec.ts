import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ChatService } from './chat.service';
import { environment } from '../../environments/environment';

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('generates a threadId via crypto.randomUUID on construction', () => {
    expect(service.threadId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('posts to the configured apiUrl with message and threadId', () => {
    service.sendMessage('hello').subscribe((resp) => {
      expect(resp.response).toBe('hi back');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/agents/chat`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ message: 'hello', threadId: service.threadId });
    req.flush({ response: 'hi back' });
  });

  it('sends the same threadId across multiple calls (CONV-01)', () => {
    service.sendMessage('first').subscribe();
    service.sendMessage('second').subscribe();

    const reqs = httpMock.match(`${environment.apiUrl}/api/agents/chat`);
    expect(reqs.length).toBe(2);
    expect(reqs[0].request.body.threadId).toBe(service.threadId);
    expect(reqs[1].request.body.threadId).toBe(service.threadId);
    reqs.forEach((r) => r.flush({ response: 'ok' }));
  });
});
