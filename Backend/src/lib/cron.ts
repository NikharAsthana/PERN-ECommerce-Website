import { CronJob } from "cron";
import http from "node:http";
import https from "node:https";

// send get request every 14 min to health endpoint
const job = new CronJob("*/14 * * * *", function () {
  const base = process.env.FRONTEND_URL;
  if (!base) return;
  const url = new URL("/health", base).href;
  const client = url.startsWith("https:") ? https : http;

  client
    .get(url, (res) => {
      if (res.statusCode === 200) {
        console.log("Sent GET request successfully");
      } else {
        console.log("GET request failed", res.statusCode);
      }
    })
    .on("error", (e) => console.log("Error while sending request", e));
});

export default job;