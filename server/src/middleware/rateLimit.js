import rateLimit from "express-rate-limit";

const tooMany = { error: "Too many attempts. Try again later." };

// Login: only FAILED tries count, so a real user who logs in fine is never blocked
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 failed tries per IP in that time
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7", // tells the client how many tries are left
  legacyHeaders: false,
  message: tooMany,
});

// Register: every request counts, because making accounts is the abuse
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooMany,
});
