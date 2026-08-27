import { Router } from "express";
import { requireAdmin, getImageKitAuth, listAdminProducts, createAdminProducts, updateAdminProducts, deleteAdminProduct } from "../controllers/adminController";

const router = Router();

// before running any of the admin routes, we want to run an admin check
router.use(requireAdmin);

// route to get credentials from imagekit. needed for uploading images for products.
// all these routes are prefixed by /api/admin
router.get("/imagekit/auth", getImageKitAuth);
router.get("/products", listAdminProducts);
router.post("/products", createAdminProducts);
router.patch("/products/:id", updateAdminProducts);
router.delete("/products/:id", deleteAdminProduct);



export default router;
