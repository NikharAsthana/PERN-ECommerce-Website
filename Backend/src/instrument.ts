import "dotenv/config";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const dsn = process.env.SENTRY_DSN;

// nodeProfilingIntegration used for performance debugging
if(dsn){
    Sentry.init({
        dsn: dsn,
        environment: process.env.NODE_ENV ?? "development",
        integrations: [nodeProfilingIntegration()],
        enableLogs: true,
        tracesSampleRate: 1.0,  // 1.0 in dev, can be lower in production
        profileSessionSampleRate: 1.0,
        profileLifecycle: "trace",
        sendDefaultPii: true,
    });
}