import type { Request, Response } from "express";
import { getEnv } from "../lib/env";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { parseRole } from "../lib/roles";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
export async function clerkWebhookHandler(req: Request, res: Response) {
  const env = getEnv();
  try {
    // cant trust incoming post requests without webhook verification (which needs a shared secret)
    if (!env.CLERK_WEBHOOK_SECRET) {
      res.status(503).send("Webhook secret missing");
      return;
    }
    // clerk's verifier expects web request with a raw body.
    // express may provide a buffer or a string
    const payload =
      req.body instanceof Buffer
        ? req.body.toString("utf-8")
        : String(req.body);

    const request = new Request("http://internal/webhooks/clerk", {
      method: "POST",
      headers: new Headers(req.headers as HeadersInit),
      body: payload,
    });

    // throws if signature is wrong or body was altered/tampered
    // only after that we trust evt.
    const evt = await verifyWebhook(request, {
      signingSecret: env.CLERK_WEBHOOK_SECRET,
    });

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const u = evt.data;

      const email =
        u.email_addresses?.find((e) => e.id === u.primary_email_address_id)
          ?.email_address ?? u.email_addresses?.[0]?.email_address;
      /*It works in three stages:

    Stage 1: The Primary Search
    u.email_addresses?.find((e) => e.id === u.primary_email_address_id)?.email_address
    It looks through the email_addresses array to find an entry whose ID matches the user's "primary" email ID. 
    If found, it grabs that specific email string.

    Stage 2: Optional Chaining (?.)
    The code uses ?. multiple times. 
    This means: "If any part of this chain is null or undefined (e.g., if the user has no emails at all), stop here and return 'undefined'
    instead of throwing an error."

    Stage 3: Nullish Coalescing (??)
    ... ?? u.email_addresses?.[0]?.email_address;
    If Stage 1 failed (the primary email wasn't found or the list was empty), the ?? operator kicks in. 
    It says: "Since the first part resulted in null/undefined, use this instead." 
    The fallback is to simply take the very first email address in the array ([0]). 
    */

      const displayName =
        [u.first_name, u.last_name].filter(Boolean).join(" ") ||
        u.username ||
        null;

      const role = parseRole(u.public_metadata?.role);
      await db
        .insert(users)
        .values({
          clerkUserId: u.id,
          email, // same as email: email
          displayName,
          role,
        })
        .onConflictDoUpdate({
          // if user already existed it would create a conflict
          target: users.clerkUserId,
          set: { email, displayName, role, updatedAt: new Date() },
        });
    }

    if (evt.type === "user.deleted") {
      const id = evt.data.id;
      if (id) {
        await db.delete(users).where(eq(users.clerkUserId, id));
      }
    }
    res.json({ ok: true });
  } catch (error) {
    // in case of a db error, incorrect payload or bad signature
    // do not give/leak details to client
    console.log("clerk webhook error", error);
    res.status(400).json({ error: "invalid webhook" });
  }
}
