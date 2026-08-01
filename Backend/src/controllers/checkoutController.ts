import type { Request, Response, NextFunction } from "express";
import { loadEnv } from "../lib/env";
import z from "zod";
import { getAuth } from "@clerk/express";
import { getLocalUser } from "../lib/users";
import { db } from "../db";
import { CheckoutSessionLine, checkoutSessions, products } from "../db/schema";
import { and, inArray, eq } from "drizzle-orm";
import { polarCreateCheckout } from "../lib/polar";

const env = loadEnv();

const cartSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export async function createCheckout(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // checking if user is signed in
    const { userId, isAuthenticated } = getAuth(req);
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const parsed = cartSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid cart", details: parsed.error.flatten() });
      return;
    }
    if (!env.POLAR_ACCESS_TOKEN) {
      res.status(503).json({ error: "payments not configure" });
      return;
    }
    const localUser = await getLocalUser(userId);
    if (!localUser) {
      res.status(503).json({ error: "account not synced yet" });
      return;
    }
    const ids = parsed.data.items.map((i) => i.productId);
    // load all the existing active products with matching product ids
    const prodRows = await db
      .select()
      .from(products)
      .where(and(inArray(products.id, ids), eq(products.active, true)));

    if (prodRows.length !== ids.length) {
      res.status(400).json({ error: "one or more products invalid" });
      return;
    }

    const byId = new Map(prodRows.map((p) => [p.id, p]));
    let totalCents = 0;
    const lines: CheckoutSessionLine[] = [];
    for (const line of parsed.data.items) {
      const p = byId.get(line.productId)!; // ! non null assertion for ts
      totalCents += p.priceCents * line.quantity;
      lines.push({
        productId: p.id,
        quantity: line.quantity,
        unitPriceCents: p.priceCents,
      });
    }
    // unnecessary precaution but trying to cover everything.
    // no product will be priced so low so we'll never hit this anyway
    if (totalCents < 60) {
      // 10 for usd, while setting up for inr polar rquired 60inr minimum
      res.status(400).json({
        error: "Total amount does not exceed polar minimum",
      });
      return;
    }

    // on checkout we want to store the checkout to our db
    // destructuring bcoz we want the 1st elem of the returned array
    // same as : session = returnedArray[0];
    // creating the checkoutSession with state set as pending which changes to paid upon payment
    // once done polar sends order.paid event state is changed from pending to paid
    // once order is created, then can delete the checkoutsession from the db
    // will handle using webhook
    const [session] = await db
      .insert(checkoutSessions)
      .values({
        userId: localUser.id,
        lines,
        totalCents,
        currency: "inr",
      })
      .returning();

    const returnUrl = `${env.FRONTEND_URL}/cart`;
    const successUrl = `${env.FRONTEND_URL}/checkout/return?checkout_id={CHECKOUT_ID}`;
    const checkout = await polarCreateCheckout(env, {
      products: [env.POLAR_CHECKOUT_PRODUCT_ID], // the product that we set up and will overwrite. see polar docs for more
      prices: {
        [env.POLAR_CHECKOUT_PRODUCT_ID]: [
          {
            amount_type: "fixed",
            price_currency: "inr",
            price_amount: totalCents,
          },
        ],
      },
      success_url: successUrl,
      return_url: returnUrl,
      external_customer_id: userId,
      metadata: { checkout_session_id: session.id },
      // needed for webhooks
    });

    //update db with id for webhooks and support
    await db
      .update(checkoutSessions)
      .set({ polarCheckoutId: checkout.id })
      .where(eq(checkoutSessions.id, session.id));

    res.json({ checkoutUrl: checkout.url });
  } catch (error) {
    next(error);
  }
}
