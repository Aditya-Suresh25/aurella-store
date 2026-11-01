export type AssistantProduct = {
  slug: string;
  name: string;
  category: string;
  categorySlug: string;
  descriptor: string;
  description: string;
  priceCents: number;
  currency: string;
  imageUrl: string;
  imageAlt: string;
  stockQuantity: number;
  reviewHighlights?: string[];
};

export type AssistantOrderLine = {
  requestedTerm: string;
  quantity?: number;
  options: AssistantProduct[];
  selectedSlug?: string;
  exactName?: boolean;
};

export type AssistantOrderPlan = {
  lines: AssistantOrderLine[];
  autoAdd?: boolean;
  message?: string;
};

export type AssistantSearchIntent = {
  query: string;
  categorySlugs: string[];
  maxPriceCents: number;
  inStockOnly: boolean;
};

export type AssistantProductGroup = {
  categorySlug: string;
  categoryName: string;
  products: AssistantProduct[];
  hasMore: boolean;
  nextOffset?: number;
  searchIntent: AssistantSearchIntent;
};

export type AssistantBagRequest = {
  productSlug: string;
  quantity: number;
};

export type AssistantSessionState = {
  mode: "idle" | "selecting" | "quantity" | "quote";
  orderPlan?: AssistantOrderPlan;
  actionId?: string;
  completedActionId?: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  lastProductSlugs?: string[];
};
