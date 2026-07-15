import { pgTable, text, integer, timestamp, uuid, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export type OrderStatus = "pending" | "paid" | "failed";
export type UserRole = "customer" | "support" | "adming";

export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    email: text("email").notNull().default(""),
    displayName: text("display_name"),
    role: text("role").$type<UserRole>().notNull().default("customer"),
    createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", {withTimezone: true}).defaultNow().notNull(),
});
// convention: keep key camelcase and col name in snakecase

export const products = pgTable("products", {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull().default("General"),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("INR"),
    imageUrl: text("image_url"),
    imageKitFileId: text("image_kit_file_id"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
});

// cents map directly to paise, and polar supports INR.
// imagekitfileid for deleting images