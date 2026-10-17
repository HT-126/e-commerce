// Usage: router.get("/", validate(someSchema), handler)
// One schema can describe body, query and params together
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });
  if (!result.success) {
    return res.status(400).json({
      error: "Validation failed",
      detail: result.error.issues.map((i) => ({
        field: i.path.slice(1).join("."), // drop "query"/"body"/"params"
        message: i.message,
      })),
    });
  }
  // version: in Express 5, req.query is read-only, so we do not overwrite it.
  req.validated = result.data; //gắn data đã validate vào request
  next();
};

//	Reusable validate(schema): returns a 400, or puts clean data in req.validated
