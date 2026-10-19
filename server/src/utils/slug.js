// "Summer Dress (Red)" -> "summer-dress-red". Matches the handle rule used by the product routes:
// lower case letters and digits, joined by single dashes, at most 100 characters.
export function slugify(text) {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // drop accents: é -> e
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");
  return slug || "product";
}
