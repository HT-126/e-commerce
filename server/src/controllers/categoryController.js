import * as categoryService from "../services/categoryService.js";

export async function list(req, res) {
  res.json(await categoryService.getCategoryTree());
}
