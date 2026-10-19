import * as cartService from "../services/cartService.js";

// The user id always comes from the cookie (req.user), NEVER from the body

export async function get(req, res) {
  res.json(await cartService.getCart(req.user.id));
}

export async function add(req, res) {
  const result = await cartService.addItem(req.user.id, req.validated.body);
  res.status(201).json(result);
}

export async function update(req, res) {
  const { variantId } = req.validated.params;
  const { quantity } = req.validated.body;
  res.json(await cartService.setQuantity(req.user.id, variantId, quantity));
}

export async function remove(req, res) {
  await cartService.removeItem(req.user.id, req.validated.params.variantId);
  res.status(204).end(); // success, nothing to send back
}
