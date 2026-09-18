import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ClerkProvider } from "@clerk/react";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
import { SentryErrorFallback } from "./components/SentryErrorFallback.jsx";
import { SentryUserSync } from "./components/sentryUserSync.jsx";

const queryClient = new QueryClient();

const apiBase = import.meta.env.VITE_API_URL ?? "";
const tracePropagationTargets =
  apiBase.length > 0
    ? [apiBase]
    : typeof window !== "undefined" // checks whether code is running in the browser. browse -> window exists
      ? [window.location, origin]
      : [];

// browser tracing integration:
// lets sentry track page load timing,
// route/navigation timing, slow frontend interactions,
//  outgoing requests and frontend to backend track linking.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      maskAllInputs: false,
      maskAllMedia: false,
    }),
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets: tracePropagationTargets,
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
});

// these stats should be 1.0 in development.
//  once in prod, it can be lowered to 0.5 or 0.1

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClerkProvider>
      <SentryUserSync />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Sentry.ErrorBoundary fallback={<SentryErrorFallback />}>
            <App />
          </Sentry.ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
);
