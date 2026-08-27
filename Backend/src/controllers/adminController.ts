import { getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";
import { isAdmin } from "../lib/roles";
import { getLocalUser } from "../lib/users";
import ImageKit from "@imagekit/nodejs";
import { getEnv } from "../lib/env";
import { db } from "../db";
import { orderItems, products } from "../db/schema";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { deleteImageKitAsset } from "../lib/imagekit";

const env = getEnv();

const productCreate = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1).default("General"),
  description: z.string().default(""),
  priceCents: z.number().int().positive(),
  currency: z.string().min(1).default("usd"),
  imageUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .nullable(),
  imageKitFileId: z
    .union([z.string().min(1), z.literal(""), z.null()])
    .optional(),
  active: z.boolean().default(true),
});

const productPatch = productCreate.partial();

function buildProductUpdateSet(body: z.infer<typeof productPatch>) {
  const data: Partial<typeof products.$inferInsert> = {};
  if (body.slug !== undefined) data.slug = body.slug;
  if (body.name !== undefined) data.name = body.name;
  if (body.category !== undefined) data.category = body.category;
  if (body.description !== undefined) data.description = body.description;
  if (body.priceCents !== undefined) data.priceCents = body.priceCents;
  if (body.currency !== undefined) data.currency = body.currency;
  if (body.imageUrl !== undefined)
    data.imageUrl = body.imageUrl === "" ? null : body.imageUrl;
  if (body.imageKitFileId !== undefined) {
    data.imageKitFileId =
      body.imageKitFileId === "" ? null : body.imageKitFileId;
  }
  if (body.active !== undefined) data.active = body.active;
  return data;
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { userId, isAuthenticated } = getAuth(req);
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const user = await getLocalUser(userId);
    if (!isAdmin(user.role)) {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

// see docs
export async function getImageKitAuth(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const client = new ImageKit({ privateKey: env.IMAGEKIT_PRIVATE_KEY });
    const auth = client.helper.getAuthenticationParameters();
    res.json({
      ...auth,
      publicKey: env.IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: env.IMAGEKIT_URL_ENDPOINT,
    });
  } catch (error) {
    next(error);
  }
}

export async function listAdminProducts(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const rows = await db
      .select()
      .from(products)
      .orderBy(desc(products.createdAt));
    res.json({ products: rows });
  } catch (error) {
    next(error);
  }
}

export async function createAdminProducts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = productCreate.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid body", details: parsed.error.flatten() });
      return;
    }
    const { imageUrl, imageKitFileId, ...rest } = parsed.data;
    const [row] = await db
      .insert(products)
      .values({
        ...rest,
        imageUrl: imageUrl || null,
        imageKitFileId: imageKitFileId || null,
      })
      .returning();
    res.status(201).json({ product: row });
  } catch (error) {
    next(error);
  }
}

export async function updateAdminProducts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = productPatch.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid body", details: parsed.error.flatten() });
      return;
    }
    const data = buildProductUpdateSet(parsed.data);
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "no fields to update" });
      return;
    }

    const [row] = await db
      .update(products)
      .set(data)
      .where(eq(products.id, req.params.id as string))
      .returning();

    if (!row) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ product: row });
  } catch (error) {
    next(error);
  }
}

export async function deleteAdminProduct(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id as string;
  // check if product exists
  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "not found" });
    return;
  }

  // counts the number of times the product we'are trying to delete is currently present in orders
  const [countRow] = await db
    .select({ c: count() })
    .from(orderItems)
    .where(eq(orderItems.productId, id));

    if(Number(countRow?.c ?? 0) > 0){
        res.status(409).json({
            error: "This product is in one or more orders and can't be deleted. Try deactivating instead."
        });
        return;
    }
    await deleteImageKitAsset(env, existing.imageKitFileId);
    await db.delete(products).where(eq(products.id, id));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
