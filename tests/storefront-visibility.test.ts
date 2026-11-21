import test from "node:test";
import assert from "node:assert/strict";
import {defaultVisibility,parseVisibility,visibilitySchema,visibilityStyles} from "../src/lib/storefront-visibility";
test("tracking starts hidden and saved visibility can restore it",()=>{
 assert.equal(parseVisibility(null).tracking,false);
 assert.match(visibilityStyles(defaultVisibility),/seguimiento/);
 assert.doesNotMatch(visibilityStyles({...defaultVisibility,tracking:true}),/seguimiento/);
});
test("visibility accepts only boolean controls, never arbitrary selectors or private settings",()=>{
 assert.equal(visibilitySchema.safeParse({tracking:"false"}).success,false);
 assert.equal(visibilitySchema.safeParse({admin:false}).success,false);
 assert.deepEqual(parseVisibility({tracking:true}),{...defaultVisibility,tracking:true});
 assert.match(visibilityStyles({...defaultVisibility,stock:false}),/stock-notice-floating/);
 assert.doesNotMatch(visibilityStyles(Object.fromEntries(Object.keys(defaultVisibility).map(k=>[k,false])) as typeof defaultVisibility),/consent|unit-colors|admin/);
});
