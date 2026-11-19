import data from "@/data/colombia-locations.json";

// Official DANE DIVIPOLA snapshot, bundled so checkout never depends on an external API.
export const departments = data.departments;
const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export function citiesForDepartment(name: string) {
  return departments.find((department) => normalize(department.name) === normalize(name))?.cities ?? [];
}
export function isColombiaLocation(state: string, city: string) {
  return citiesForDepartment(state).some((item) => normalize(item.name) === normalize(city));
}
