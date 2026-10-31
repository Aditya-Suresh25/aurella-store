export type BagItem = {
  id: number;
  productSlug: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  priceCents: number;
  currency: string;
  imageUrl: string;
  imageAlt: string;
  quantity: number;
  stockQuantity: number;
};

export type BagData = {
  items: BagItem[];
  itemCount: number;
  subtotalCents: number;
  currency: string;
};

export type BagActionResult<T = BagData> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: "UNAUTHENTICATED" | "NOT_FOUND" | "OUT_OF_STOCK" | "INVALID_QUANTITY" | "CURRENCY_MISMATCH" };
