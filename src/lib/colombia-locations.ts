import data from "@/data/colombia-locations.json";

// Official DANE DIVIPOLA snapshot, bundled so checkout never depends on an external API.
export const departments = data.departments;
const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export type LocationOption = { code: string; name: string };
const aliases: Record<string, string[]> = {
  "54001": ["CÚCUTA"],
  "76001": ["CALI"],
  "13001": ["CARTAGENA"],
};
export function locationLabel(option: LocationOption) {
  const alias = aliases[option.code]?.[0];
  return alias && normalize(alias) !== normalize(option.name) ? `${alias} (${option.name})` : option.name;
}
export function filterLocations(options: LocationOption[], query: string) {
  const prefix = normalize(query);
  return options.filter(option => [option.name, ...(aliases[option.code] ?? [])].some(name => normalize(name).includes(prefix)))
    .sort((a, b) => locationLabel(a).localeCompare(locationLabel(b), "es"));
}
export function citiesForDepartment(name: string) {
  return departments.find((department) => normalize(department.name) === normalize(name))?.cities ?? [];
}
export function isColombiaLocation(state: string, city: string) {
  return citiesForDepartment(state).some((item) => normalize(item.name) === normalize(city));
}
