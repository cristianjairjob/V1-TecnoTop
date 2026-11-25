import test from "node:test";
import assert from "node:assert/strict";
import { defaultHighlights, productHighlights, highlightsSchema, displayStockSchema } from "../src/lib/product-presentation";
test("historical products retain default phrases; each product can override or hide phrases",()=>{
 assert.deepEqual(productHighlights(null),defaultHighlights);
 assert.deepEqual(productHighlights(["Sonido potente","","Garantía"]),["Sonido potente","","Garantía"]);
 assert.deepEqual(productHighlights(["Otro producto","Color negro",""]),["Otro producto","Color negro",""]);
 assert.equal(highlightsSchema.safeParse(["a","b"]).success,false);
 assert.equal(highlightsSchema.safeParse(["x".repeat(201),"",""]).success,false);
 assert.equal(productHighlights(["Texto con ","",""])[0],"Texto con ");
});
test("display stock is optional and rejects fractional, negative and excessive values",()=>{
 for(const n of [null,0,10,1000000]) assert.equal(displayStockSchema.safeParse(n).success,true);
 for(const n of [-1,1.5,1000001,"10"]) assert.equal(displayStockSchema.safeParse(n).success,false);
});
