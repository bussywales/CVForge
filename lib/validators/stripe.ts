import { z } from "zod";

export const checkoutSchema = z.object({
  priceId: z.string().min(1).optional(),
});

export type CheckoutSchema = z.infer<typeof checkoutSchema>;
