import { apiFetch } from "../lib/api";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

// hook used for this:
// localhost:5173?category=toys
export function useHomeCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category")?.trim() ?? "";

  const setCategory = (category) => {
    const next = new URLSearchParams(searchParams);
    if (!category) next.delete("category");
    else next.set("category", category);

    setSearchParams(next, { replace: true });
  };

  //   calls the getCategories route in productRouter.ts
  const { data: categoriesData, isLoading: loadingCategories } = useQuery({
    queryKey: ["product-categories"],
    queryFn: () => apiFetch("/api/products/categories"),
  });
  // rename important because of multiple "data" consts from deconstructed object from the hook
  const {
    data: productsData,
    isLoading: loadingList,
    error,
  } = useQuery({
    queryKey: ["products", categoryFilter],
    queryFn: () =>
      apiFetch(
        categoryFilter
          ? `/api/products?category=${encodeURIComponent(categoryFilter)}`
          : "/api/products",
      ),
    // uriencode turns the catogryFilter string URL friendly eg: "apples and bananas" -> "apples%20and%20bananas" [urls dont have whitespaces in between]
  });

  // see productRouter and then productController, getCategories returns "categories" and listProducts returns products, so that is whats used
  const categories = categoriesData?.categories ?? [];

  const products = productsData?.products ?? [];

  // for the number of categories shown on homepage
  const categoryChipsLoading = loadingCategories && categories.length === 0;

  return {
    categoryFilter,
    setCategory,
    categories,  
    products,
    categoryChipsLoading,
    loadingCategories,
    loadingList,
    error,
  };
}
