import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { appRoutes } from './app.routes';
import { reducers } from './store/reducers';
import { appEffects } from './store/effects';
import { environment } from '../environments/environment';

// Prism.js core + language components for fenced code block highlighting.
import 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-python';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(),
    provideMarkdown(),
    provideStore(reducers),
    provideEffects(appEffects),
    // Redux DevTools — dev builds only (disabled in production).
    ...(environment.production
      ? []
      : [provideStoreDevtools({ maxAge: 50, connectInZone: true })]),
  ],
};
