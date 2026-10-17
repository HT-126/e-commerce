import fs from "node:fs";
import { productSchema } from "../schemas/productRow.js";


// I wrote compare_at_price_usd, reviews.rating as nullable(). 
// //I did not check how the file shows "no value" (it may be null, or the key may be missing, or 0). so write test
const products = JSON.parse(fs.readFileSync("../data/products.json", "utf8"));
const bad = [];
for (const p of products) {
  const result = productSchema.safeParse(p);
  if (!result.success) bad.push({ handle: p.handle, issues: result.error.issues.length });
}
console.log("total:", products.length, "bad:", bad.length);
console.log(bad);
//node src/scripts/testSchema.js