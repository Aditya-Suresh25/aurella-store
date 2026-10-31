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
  quantity: number;
  options: AssistantProduct[];
  selectedSlug?: string;
};

export type AssistantOrderPlan = {
  lines: AssistantOrderLine[];
};

export type AssistantBagRequest = {
  productSlug: string;
  quantity: number;
};
