import * as checkoutService from "../services/checkoutService.js";

export async function create(req, res) {
  res.status(201).json(await checkoutService.checkout(req.user.id));
}
