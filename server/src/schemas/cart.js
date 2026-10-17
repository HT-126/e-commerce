import { z } from "zod";

// Only external input is checked here (body and params).
const variantId = z.coerce.number().int().positive(); // params are strings, so coerce
const quantity = z.number().int().min(1).max(10); // max 10 per item: simple abuse limit

export const addToCartSchema = z.object({
  body: z.object({ variantId: z.number().int().positive(), quantity }),
});

export const updateCartSchema = z.object({
  params: z.object({ variantId }),
  body: z.object({ quantity }),
});

export const removeFromCartSchema = z.object({
  params: z.object({ variantId }),
});
