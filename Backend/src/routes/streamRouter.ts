import { Router } from "express";
import { createStreamToken } from "../controllers/streamController";
const router = Router();

router.post("/token", createStreamToken); // will be prefixed by "/api/stream"

export default router