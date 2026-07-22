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

const env = getEnv();
const app = express();
const rawJson = express.raw({ type: "application/json", limit: "1mb" });

// clerk sends event within the webhook through a post request on this route.
// the handler needs the event as raw json, so using the express.json middleware before it will cause problems. Thus, keeping the webhooks route above/before the express.json middleware.
// its necessary to not parse webhook event data, and it should be in the raw format
app.post("/webhooks/clerk", rawJson, (req, res) => {
  void clerkWebhookHandler(req, res);
});

app.use(express.json()); //body parser
app.use(cors());
app.use(clerkMiddleware());

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

app.listen(env.PORT, () => {
  console.log("Listening on port: " + env.PORT);
});
