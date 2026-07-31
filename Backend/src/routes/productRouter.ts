import { Router } from "express";
import { listProducts, getCategories, getProductBySlug } from "../controllers/productController";

const router = Router();
// routes here are prefixed with /api/products
// allow users to get products
router.get("/", listProducts);
router.get("/categories", getCategories);
router.get("/:slug", getProductBySlug);

// order is important. if slug goes before categories,
// it will cause problems and not work as expected


export default router;
