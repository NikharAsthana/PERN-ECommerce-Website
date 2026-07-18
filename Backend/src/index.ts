// Docs
// https://clerk.com/docs/expressjs/getting-started/quickstart

import express from  "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { clerkWebhookHandler } from "./webhooks/clerk";
import "dotenv/config";
import { getEnv } from "./lib/env";

const env = getEnv();
const app = express();
const rawJson = express.raw({type: "application/json", limit: "1mb"});

// clerk sends event within the webhook through a post request on this route.
// the handler needs the event as raw json, so using the express.json middleware before it will cause problems. Thus, keeping the webhooks route above/before the express.json middleware.
app.post("/webhooks/clerk", rawJson, (req,res)=>{
    void clerkWebhookHandler(req,res); 
})

app.use(express.json()); //body parser
app.use(cors());
app.use(clerkMiddleware()); 


app.listen(env.PORT, ()=>{
    console.log("Listening on port: " + env.PORT);
});
