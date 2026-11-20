"use client";
import { useEffect, useId, useRef, useState } from "react";
import { filterLocations, locationLabel, type LocationOption } from "@/lib/colombia-locations";

export function LocationCombobox({ label, name, options, value, onChange, disabled = false, placeholder }: {
  label: string; name: string; options: LocationOption[]; value: string; onChange: (value: string) => void; disabled?: boolean; placeholder: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.find(option => option.name === value);
  const filtered = filterLocations(options, selected ? "" : query);
  const expanded = open && !disabled;
  useEffect(() => { input.current?.setCustomValidity(!disabled && !selected && query ? "Selecciona una opción de la lista." : ""); }, [selected, query, disabled]);
  useEffect(() => { if (expanded) list.current?.children[active]?.scrollIntoView({ block: "nearest" }); }, [active, expanded]);
  function select(option: LocationOption) { onChange(option.name); setQuery(""); setOpen(false); setActive(0); input.current?.setCustomValidity(""); }
  return <div className="location-combobox" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id}>{label}</label>
    <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={`${id}-list`}
      aria-activedescendant={expanded && filtered[active] ? `${id}-option-${active}` : undefined}
      autoComplete="off" spellCheck={false} required disabled={disabled} placeholder={placeholder}
      value={selected ? locationLabel(selected) : query}
      onFocus={event => { setOpen(true); setActive(0); event.target.select(); }}
      onChange={event => { setQuery(event.target.value); onChange(""); setActive(0); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive(i => expanded ? Math.min(i + 1, Math.max(filtered.length - 1, 0)) : 0); }
        else if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(i => Math.max(i - 1, 0)); }
        else if (event.key === "Enter" && expanded) { event.preventDefault(); if (filtered[active]) select(filtered[active]); }
        else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      }} />
    <input type="hidden" name={name} value={selected?.name ?? ""} disabled={disabled} />
    {expanded && <div className="location-options"><ul ref={list} id={`${id}-list`} role="listbox" aria-label={label}>
      {filtered.map((option, index) => <li key={option.code} id={`${id}-option-${index}`} role="option" aria-selected={index === active}
        onMouseDown={event => event.preventDefault()} onClick={() => select(option)}>{locationLabel(option)}</li>)}
    </ul>{!filtered.length && <p role="status">No hay coincidencias. Revisa el nombre o el departamento.</p>}</div>}
  </div>;
}
