import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { getLocalUser } from "../lib/users";
import { isStaff } from "../lib/roles";
import { orderItems, orders, products, users } from "../db/schema";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { getEnv } from "../lib/env";
import {
  getStreamChatServer,
  StreamChatDisplayName,
  streamUserId,
} from "../lib/stream";

const env = getEnv();

export async function listOrders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // user sees their own orders, admin/staff sees all orders
  try {
    // get user auth
    const { userId, isAuthenticated } = getAuth(req);
    if (!userId || !isAuthenticated) {
      res.status(401).json({ error: "unauthorised" });
      return;
    }
    const localUser = await getLocalUser(userId);
    if (!localUser) {
      res.status(503).json({ error: "account not synced yet" });
      return;
    }

    const rows = isStaff(localUser.role)
      ? await db.select().from(orders).orderBy(desc(orders.createdAt))
      : await db
          .select()
          .from(orders)
          .where(eq(orders.userId, localUser.id))
          .orderBy(desc(orders.createdAt));

    const orderIds = rows.map((r) => r.id);
    const previewByOrder = new Map();

    if (orderIds.length > 0) {
      // do inner join
      const itemRows = await db
        .select({
          orderId: orderItems.orderId,
          quantity: orderItems.quantity,
          name: products.name,
          slug: products.slug,
          imageUrl: products.imageUrl,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(inArray(orderItems.orderId, orderIds))
        .orderBy(asc(orderItems.id));

      for (const row of itemRows) {
        // An order can have multiple order items, so multiple rows can have the same orderId.
        // Get the existing list of items for this orderId.
        // If this is the first item for the order, get() returns undefined,
        // so ?? [] gives us a new empty array.
        const list = previewByOrder.get(row.orderId) ?? [];
        // Add the current order item to the order's list.
        list.push({
          name: row.name,
          slug: row.slug,
          imageUrl: row.imageUrl,
          quantity: row.quantity,
        });
        // Save the updated list back in the Map using orderId as the key.
        previewByOrder.set(row.orderId, list);
      }
    }

    // return to client
    const ordersPayload = rows.map((o) => ({
      ...o,
      previewItems: previewByOrder.get(o.id) ?? [],
    }));
    res.json({ orders: ordersPayload }); // sends status 200 by default
  } catch (e) {
    next(e);
  }
}

export async function getOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { userId, isAuthenticated } = getAuth(req);
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "unauthorised" });
      return;
    }

    const localUser = await getLocalUser(userId);
    if (!localUser) {
      res.status(503).json({ error: "account not synced yet" });
      return;
    }
    // check if order exists or not
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.id as string))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "not found" });
      return;
    }

    // check if user has access to the order they have requested
    const canAccess = order.userId === localUser.id || isStaff(localUser.role);

    if (!canAccess) {
      res.status(404).json({ error: "not found" });
      return;
    }

    const items = await db
      .select({
        id: orderItems.id,
        quantity: orderItems.quantity,
        unitPriceCents: orderItems.unitPriceCents,
        product: products, // whole products table but needs join
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, order.id));

    res.json({ order, items });
  } catch (e) {
    next(e);
  }
}

export async function createStreamChannel(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { userId, isAuthenticated } = getAuth(req);
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "unauthorised" });
      return;
    }

    const server = getStreamChatServer(env);

    const localUser = await getLocalUser(userId);
    if (!localUser) {
      res.status(503).json({ error: "account not synced yet" });
      return;
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.id as string))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "not found" });
      return;
    }

    const isOwner = order.userId === localUser.id;
    if (!isOwner && !isStaff(localUser.role)) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (order.status !== "paid") {
      res.status(403).json({
        errror: "order not paid. order must be paid to open support chat",
      });
      return;
    }

    const streamChatUserId = streamUserId(userId);
    await server.upsertUser({
      id: streamChatUserId,
      name: StreamChatDisplayName(
        localUser.role,
        localUser.displayName,
        localUser.email,
      ),
    });

    const channelId = `order-${order.id}`;
    const channel = server.channel("messaging", channelId, {
      name: `Support • order ${order.id.slice(0, 8)}`,
      created_by_id: streamChatUserId,
    });

    await channel.create();
    await channel.addMembers([streamChatUserId]);

    res.json({
      channelType: "messaging",
      channelId,
      streamUserId,
      streamChatUserId,
    });
  } catch (e) {
    next(e);
  }
}

export async function createVideoInvite( 
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { userId, isAuthenticated } = getAuth(req);
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "unauthorised" });
      return;
    }

    const server = getStreamChatServer(env);

    const localUser = await getLocalUser(userId);
    if (!localUser) {
      res.status(503).json({ error: "account not synced yet" });
      return;
    }

    if (!isStaff(localUser.role)) {
      res
        .status(403)
        .json({ error: "only support/admin can send video invite" });
      return;
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.id as string))
      .limit(1);

    if (!order || order.status !== "paid") {
      res.status(404).json({ error: "order not found or not paid" });
      return;
    }

    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, order.userId))
      .limit(1);

    const customerSid = streamUserId(owner.clerkUserId);
    await server.upsertUser({
      id: customerSid,
      name: owner.displayName ?? owner.email ?? "customer",
    });

    const staffStreamUserId = streamUserId(userId);
    await server.upsertUser({
      id: staffStreamUserId,
      name: StreamChatDisplayName(
        localUser.role,
        localUser.displayName,
        localUser.email,
      ),
    });

    const channelId = `order-${order.id}`;
    const channel = server.channel("messaging", channelId, {
      name: `Support • order ${order.id.slice(0, 8)}`,
      created_by_id: customerSid,
    });

    await channel.create();
    await channel.addMembers([customerSid, staffStreamUserId]);

    const joinUrl = `${env.FRONTEND_URL.replace(/\/+$/, "")}/orders/${order.id}/call`;
    // removes any / characters at the end of the frontend URL.

    await channel.sendMessage({
      text: `Video call- tap Join below (same link for everyone): ${joinUrl}`,
      user_id: staffStreamUserId,
      custom: {
        video_invite: true,
        join_url: joinUrl,
      },
    });

    res.json({ ok: true, joinUrl });
  } catch (e) {
    next(e);
  }
}
