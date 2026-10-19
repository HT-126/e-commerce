import * as authService from "../services/authService.js";
import { signToken, authCookieOptions } from "../utils/token.js";

export async function register(req, res) {
  const { email, password } = req.validated.body;
  const user = await authService.register(email, password);
  res.status(201).json(user);
}

export async function login(req, res) {
  const { email, password } = req.validated.body;
  const user = await authService.authenticate(email, password);
  const token = await signToken(user);
  res.cookie("token", token, authCookieOptions);
  res.json(user);
}

export function me(req, res) {
  res.json(req.user);
}

export function logout(req, res) {
  // clearCookie needs the same path/httpOnly/sameSite/secure as the cookie.
  // We remove maxAge: in Express 4, a maxAge here keeps the cookie alive.
  const { maxAge, ...clearOptions } = authCookieOptions;
  res.clearCookie("token", clearOptions);
  res.json({ ok: true });
}
