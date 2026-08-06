import type { Request, Response } from "express";
import { getEnv } from "../lib/env";
import { checkoutSessions, orderItems, orders } from "../db/schema";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { Webhook } from "standardwebhooks"; // to verify the webhook coming from pola

function headerString(headers: Request["headers"], name: string) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function checkoutSessionIdFromMetadata(order: Record<string, unknown>) {
  const metadata = order.metadata;
  if (!metadata || typeof metadata !== "object") return undefined;
  const sessionId = (metadata as Record<string, unknown>).checkout_session_id;
  return typeof sessionId === "string" ? sessionId : undefined;
}

async function fulfillCheckoutSession(
  sessionId: string,
  polarOrderId: string | undefined,
  checkoutId: string | undefined,
) {
  // need database transaction. this needs to be atomic. If one thing fails, whole thing fails. If all things succeed only then it is a success.
  return await db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(checkoutSessions)
      .where(eq(checkoutSessions.id, sessionId))
      .for("update");
    if (!session) {
      return false;
    }
    const [order] = await tx
      .insert(orders)
      .values({
        userId: session.userId,
        status: "paid",
        totalCents: session.totalCents,
        polarCheckoutId: checkoutId ?? session.polarCheckoutId ?? null,
        ...(polarOrderId ? { polarOrderId } : {}), //If polarOrderId is truthy, add a polarOrderId property to this object. Otherwise, add nothing.
      })
      .returning();

    if (session.lines.length) {
      await tx.insert(orderItems).values(
        session.lines.map((line) => ({
          orderId: order.id,
          productId: line.productId,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
        })),
      );
    }
    // since they are under a transaction. if one succeeds but another fails, the transaction fails 

    // we've created the order so dont need the checkoutSession entry anymore
    await tx.delete(checkoutSessions).where(eq(checkoutSessions.id, sessionId));
    return true;
  });
}

async function alreadyPaid(polarOrderId?: string, checkoutId?: string) {
  if (polarOrderId) {
    const [row] = await db
      .select()
      .from(orders)
      .where(eq(orders.polarOrderId, polarOrderId))
      .limit(1);
    if (row?.status === "paid") return true;
  }
  if (checkoutId) {
    const [row] = await db
      .select()
      .from(orders)
      .where(eq(orders.polarCheckoutId, checkoutId))
      .limit(1);
    if (row?.status === "paid") return true;
  }
  return false;
}

export async function polarWebhookHandler(req: Request, res: Response) {
  const env = getEnv();

  try {
    if (!env.POLAR_WEBHOOK_SECRET) {
      res.status(503).send("Polar webhooks have not been configured");
      return;
    }
    // getting raw data from polar
    const raw =
      req.body instanceof Buffer ? req.body : Buffer.from(String(req.body));
    const wh = new Webhook(
      Buffer.from(env.POLAR_WEBHOOK_SECRET, "utf-8").toString("base64"),
    );
    // to check whether the webhook is legit
    const id = headerString(req.headers, "webhook-id");
    const ts = headerString(req.headers, "webhook-timestamp");
    const sig = headerString(req.headers, "webhook-signature");

    if (!id || !ts || !sig) {
      res.status(400).json({ error: "Missing webhook headers" });
      return;
    }

    wh.verify(raw, {
      "webhook-id": id,
      "webhook-timestamp": ts,
      "webhook-signature": sig,
    }); // hits catch block if it fails

    // gets the event if verified
    const event = JSON.parse(raw.toString("utf-8")) as {
      type: string;
      data?: Record<string, unknown>;
    };

    if (event.type === "order.paid" && event.data) {
      const data = event.data;
      const polarOrderId = typeof data.id === "string" ? data.id : undefined;
      const checkoutId =
        typeof data.checkout_id === "string" ? data.checkout_id : undefined;

      // if something fails polar might send the event again. we dont want to do anything if we receive order.paid again
      // tells polar to not send request again
      if (await alreadyPaid(polarOrderId, checkoutId)) {
        res.json({ ok: true, duplicate: true });
        return;
      }

      //  from checkoutController.ts, from checkout object (metadata)
      const sessionId = checkoutSessionIdFromMetadata(data);
      if (sessionId) {
        const ok = await fulfillCheckoutSession(
          sessionId,
          polarOrderId,
          checkoutId,
        );
        if (ok) {
          res.json({ ok: true });
          return;
        }
        // helps in case race condition occurs if 2 webhook requests arrive simultaneously
        /*First alreadyPaid check (before fulfillment attempt): fast-path early return. If this webhook delivery is a retry of an event you already fully processed, skip work and tell Polar "ok" immediately.
        fulfillCheckoutSession runs and returns false: this means fulfillment didn't succeed — but that could happen for two very different reasons:
        A genuine failure (DB error, invalid session, etc.)
        A race: another concurrent request (e.g. Polar fired two webhook deliveries close together, or a retry landed while the first one was still mid-flight) already fulfilled the session in the time between your first check and now. So fulfillCheckoutSession fails not because something is broken, but because the order was already marked paid by the other request.
        Second alreadyPaid check: distinguishes those two cases. If it's now true, you know the "failure" was actually just a benign race — the order did get fulfilled, just not by this invocation. You respond { ok: true, duplicate: true } instead of a 500.
        Without the second check, that race would cause you to return a 500 to Polar even though the order succeeded, and Polar would then retry the webhook — potentially triggering duplicate side effects (or at minimum, log noise and unnecessary retries) depending on how idempotent the rest of your pipeline is.
        So: first check = idempotency fast path, second check = race-condition disambiguation after a fulfillment failure. It's a "check-fail-recheck" pattern common in webhook handlers where multiple deliveries for the same event aren't guaranteed to be serialized.*/
        if (await alreadyPaid(polarOrderId, checkoutId)) {
          res.json({ ok: true, duplicate: true });
          return;
        }
        console.error("Polar order.paid: could not fulfill checkout session", {
          sessionId,
          checkoutId,
        });
        res.status(500).json({ error: "Checkout fulfillment failed" });
        return;
      }
    }
    res.json({ ok: true });
  } catch (error) {
    // to polar, not client
    console.error("Polar webhook error", error);
    res.status(400).json({ error: "Invalid Webhook" });
  }
}
