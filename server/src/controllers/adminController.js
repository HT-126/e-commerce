import * as adminService from "../services/adminService.js";

// requireAuth and requireAdmin are added in app.js, once for ALL admin routes

export async function stats(req, res) {
  res.json(await adminService.getStats(req.validated.query.days));
}

export async function orders(req, res) {
  res.json(await adminService.listOrders(req.validated.query));
}

export async function variants(req, res) {
  res.json(await adminService.listVariants(req.validated.query));
}

export async function updateVariant(req, res) {
  const { id } = req.validated.params;
  res.json(await adminService.updateVariant(id, req.validated.body));
}

export async function reviews(req, res) {
  res.json(await adminService.listReviews(req.validated.query));
}

export async function deleteReview(req, res) {
  res.json(await adminService.deleteReview(req.validated.params.id));
}

export async function createProduct(req, res) {
  res.status(201).json(await adminService.createProduct(req.validated.body));
}

export async function deleteProduct(req, res) {
  res.json(await adminService.deleteProduct(req.validated.params.id));
}
