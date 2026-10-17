import "dotenv/config"; // make sure .env is loaded before we read it
import { SignJWT, jwtVerify } from "jose";

// Fail at startup, not later at the first login
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET is missing or too short (min 32 characters) in .env",
  );
}
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function signToken(user) {
  // The payload is NOT encrypted, anyone can read it. So it only holds the user id.
  // The role is read from the database on each request (next step), so a
  // demoted admin loses power at once and not after 1 hour.
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id)) // "sub" = who this token is about
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

export const authCookieOptions = {
  httpOnly: true, // JavaScript in the page cannot read the cookie (XSS cannot steal it)
  sameSite: "lax", // not sent on cross-site POST requests (basic CSRF protection)
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  maxAge: 60 * 60 * 1000, // 1 hour, in milliseconds (same as the token)
  path: "/",
};

export async function verifyToken(token) {
  // algorithms: we decide how a token is checked. The token's own header
  // ("alg") must never decide that. Throws if the signature is wrong or the token expired.
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  return payload;
}
