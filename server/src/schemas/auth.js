import { z } from "zod";

// Same cleaning for register and login, so one email always means one account
const email = z.string().trim().toLowerCase().email().max(255);

export const registerSchema = z.object({
  body: z.object({
    email,
    // max(72): bcrypt only reads the first 72 bytes
    password: z.string().min(6).max(72),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email,
    // No min(8) here: login only CHECKS the password. The rules belong to register.
    password: z.string().min(1).max(72),
  }),
});
