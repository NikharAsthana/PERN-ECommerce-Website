import { getAuth } from "@clerk/express";
import { Router } from "express";
import { getLocalUser } from "../lib/users";

const router = Router();

// we use app.use("/api/me", meRouter) to use this. 
// the routes are prefixed with /api/me. ie url looks like xyz.com/api/me and api/me/for whatever more we write here
router.get("/", async (req, res, next) => {
  try {
    // get userid from clerk and check if user is authenticated
    const { userId, isAuthenticated } = getAuth(req);
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const user = await getLocalUser(userId);
    res.json({ user });
  } catch (e) {
    next(e);
    // sends the error to our error handling middleware
  }
});

export default router;
