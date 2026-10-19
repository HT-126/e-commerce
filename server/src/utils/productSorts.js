// Fixed SQL text for each allowed sort. The user only picks a KEY; the SQL is never user text.
// "p.id" at the end makes the order stable, so pages do not repeat rows.
// (The product table has no created date, so "newest" means the highest id.)
export const SORTS = {
  rating_desc: "p.rating DESC, p.rating_count DESC, p.id ASC",
  reviews_desc: "p.rating_count DESC, p.rating DESC, p.id ASC",
  newest: "p.id DESC",
  price_asc: "p.price_min ASC, p.id ASC",
  price_desc: "p.price_min DESC, p.id ASC",
  name_asc: "p.title ASC, p.id ASC",
  name_desc: "p.title DESC, p.id ASC",
};

export const SORT_KEYS = Object.keys(SORTS);
