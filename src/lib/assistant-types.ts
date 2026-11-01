export type AssistantProduct = {
  slug: string;
  name: string;
  category: string;
  descriptor: string;
  description: string;
  priceCents: number;
  currency: string;
  imageUrl: string;
  imageAlt: string;
  stockQuantity: number;
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
  categorySlug: string;
  maxPriceCents: number;
  inStockOnly: boolean;
};

export type AssistantBagRequest = {
  productSlug: string;
  quantity: number;
};
