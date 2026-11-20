import { test } from "node:test";
import assert from "node:assert/strict";
import { departments, citiesForDepartment, filterLocations, locationLabel, isColombiaLocation } from "../src/lib/colombia-locations";
test("departamentos filtran por inicio, sin tildes ni diferencias de mayúsculas", () => {
  assert.deepEqual(filterLocations(departments, "n").map(d => d.name), ["NARIÑO", "NORTE DE SANTANDER"]);
  assert.deepEqual(filterLocations(departments, "norte").map(d => d.name), ["NORTE DE SANTANDER"]);
  assert.deepEqual(filterLocations(departments, "  narino ").map(d => d.name), ["NARIÑO"]);
  assert.equal(filterLocations(departments, "inventado").length, 0);
});
test("Cúcuta se encuentra por nombre común u oficial y guarda el nombre validado", () => {
  const cities = citiesForDepartment("Norte de Santander");
  const result = filterLocations(cities, "cucuta");
  assert.equal(result.length, 1); assert.equal(result[0].code, "54001");
  assert.equal(locationLabel(result[0]), "CÚCUTA (SAN JOSÉ DE CÚCUTA)");
  assert.equal(filterLocations(cities, "san jose de cucuta")[0].code, "54001");
  assert.ok(isColombiaLocation("NORTE DE SANTANDER", result[0].name));
  assert.equal(filterLocations(citiesForDepartment("Santander"), "cucuta").length, 0);
  assert.equal(filterLocations(cities, "Los Patios")[0].code, "54405");
});
test("catálogo íntegro: códigos únicos y municipios asignados a su departamento", () => {
  const cities = departments.flatMap(d => d.cities);
  assert.equal(departments.length, 33); assert.equal(cities.length, 1122);
  assert.equal(new Set(cities.map(c => c.code)).size, cities.length);
  for (const d of departments) { assert.ok(d.cities.length); for (const c of d.cities) assert.ok(c.code.startsWith(d.code)); }
  assert.equal(filterLocations(departments, "").length, departments.length);
});
