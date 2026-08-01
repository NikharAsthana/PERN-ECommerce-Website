import { Router } from "express";
import { createCheckout } from "../controllers/checkoutController";

const router = Router();
// prefixed by /api/checkout
router.post("/", createCheckout);


export default router;