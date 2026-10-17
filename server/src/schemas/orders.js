import { z } from "zod";

// The id comes from the URL (a string), so we coerce it to a number
export const orderIdSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});
