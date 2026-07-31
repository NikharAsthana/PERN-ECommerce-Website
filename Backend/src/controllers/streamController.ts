import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { getLocalUser } from "../lib/users";
import {
  getStreamChatServer,
  StreamChatDisplayName,
  streamUserId,
} from "../lib/stream";
import { getEnv } from "../lib/env";

const env = getEnv();

export async function createStreamToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    //checking if user is authenticated first
    const { userId, isAuthenticated } = getAuth(req);
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const localUser = await getLocalUser(userId);
    if (!localUser) {
      res.status(503).json({ error: "account not synced yet" });
      return;
    }
    const server = getStreamChatServer(env);
    const clerkUser = await clerkClient.users.getUser(userId); // gives all user details
    const combined =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      null;
    const name = StreamChatDisplayName(
      localUser.role,
      localUser.displayName ?? combined ?? clerkUser.username,
      localUser.email,
    );
    const image = clerkUser.imageUrl || undefined;
    const sid = streamUserId(userId);
    await server.upsertUser({id: sid, name, image});
    // update or create user
    const token = server.createToken(sid)
    res.json({token, apiKey: env.STREAM_API_KEY, userId: sid});
    // return;

  } catch (e) {
    next(e);
  }
}
