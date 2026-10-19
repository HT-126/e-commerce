import * as reviewService from "../services/reviewService.js";

export async function list(req, res) {
  const { handle } = req.validated.params;
  res.json(await reviewService.listReviews(handle, req.validated.query));
}

export async function create(req, res) {
  const { handle } = req.validated.params;
  const result = await reviewService.createReview(
    req.user.id,
    handle,
    req.validated.body,
  );
  res.status(201).json(result);
}
