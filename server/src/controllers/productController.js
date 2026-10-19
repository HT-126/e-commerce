import * as productService from "../services/productService.js";

export async function list(req, res) {
  res.json(await productService.listProducts(req.validated.query));
}

export async function detail(req, res) {
  const { handle } = req.validated.params;
  res.json(await productService.getProductByHandle(handle));
}
