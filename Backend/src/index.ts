// Docs
// https://clerk.com/docs/expressjs/getting-started/quickstart

import express from "express";
import cors from "cors";

import { clerkMiddleware } from "@clerk/express";
import { clerkWebhookHandler } from "./webhooks/clerk";

import "dotenv/config";
import { getEnv } from "./lib/env";

import fs from "node:fs";
import path from "node:path";

import * as Sentry from "@sentry/node";

import stayAliveCronJob from "./lib/cron";
import productRouter from "./routes/productRouter"
import meRouter from "./routes/meRouter";
import streamRouter from "./routes/streamRouter";
import checkoutRouter from "./routes/checkoutRouter";
import adminRouter from "./routes/adminRouter";

import { polarWebhookHandler } from "./webhooks/polar";
import { sentryClerkUserMiddleware } from "./middleware/sentryClerkUser";

const env = getEnv();
const app = express();
const rawJson = express.raw({ type: "application/json", limit: "1mb" });

// clerk sends event within the webhook through a post request on this route.
// the handler needs the event as raw json, so using the express.json middleware before it will cause problems. Thus, keeping the webhooks route above/before the express.json middleware.
// its necessary to not parse webhook event data, and it should be in the raw format
app.post("/webhooks/clerk", rawJson, (req, res) => {
  void clerkWebhookHandler(req, res);
});

app.post("/webhooks/polar", rawJson, (req, res) => {
  void polarWebhookHandler(req, res);
});


app.use(express.json()); //body parser
app.use(cors());
app.use(clerkMiddleware());
app.use(sentryClerkUserMiddleware);

app.get("/health", (_req,res)=>{
  // _req is convention for when req isnt being used
  res.json({ok: true});
});

// returns currently authenticated user
// fetch user from from db as a record and send it back to client
app.use("/api/me", meRouter);
app.use("/api/products", productRouter);
app.use("/api/stream", streamRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/admin", adminRouter);





const publicDir = path.join(process.cwd(), "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  app.get("/{*any}", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }

    if (req.path.startsWith("/api") || req.path.startsWith("/webhooks")) {
      next();
      return;
    }

    res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
  });
}



Sentry.setupExpressErrorHandler(app);
// adds sentry field to the response object. It is an id that references to the error that created it.
// will give us a sentry id

app.use((_err:unknown, _req:express.Request, res:express.Response, _next:express.NextFunction) => {
  const sentryId = (res as express.Response & {sentry?: string}).sentry;
  res.status(500).json({
    error: "Internal server error",
    ...(sentryId !== undefined && { sentryId }), // dont wanna send it if its undefined
  });

});


app.listen(env.PORT, () => {
  console.log("Listening on port: " + env.PORT);
  if(env.NODE_ENV === "production"){
    stayAliveCronJob.start();
  }
});
