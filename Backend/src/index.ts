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
import stayAliveCronJob from "./lib/cron";
import productRouter from "./routes/productRouter"
import meRouter from "./routes/meRouter";
import streamRouter from "./routes/streamRouter";
import checkoutRouter from "./routes/checkoutRouter";
import { polarWebhookHandler } from "./webhooks/polar";

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

// add error handling middleware

app.listen(env.PORT, () => {
  console.log("Listening on port: " + env.PORT);
  if(env.NODE_ENV === "production"){
    stayAliveCronJob.start();
  }
});
