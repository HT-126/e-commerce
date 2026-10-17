import { z } from "zod";

export const productDetailSchema = z.object({
  params: z.object({
    handle: z
      .string()
      .max(100)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  }),
});
