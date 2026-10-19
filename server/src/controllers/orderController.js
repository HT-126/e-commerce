import * as orderService from "../services/orderService.js";

export async function list(req, res) {
  res.json(await orderService.listOrders(req.user.id, req.validated.query));
}

export async function detail(req, res) {
  res.json(await orderService.getOrder(req.user.id, req.validated.params.id));
}
