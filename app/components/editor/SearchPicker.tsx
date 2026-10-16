"use client";

import { useEffect, useId, useRef, useState } from "react";

type Group = { name: string; options: readonly (readonly [string, string])[] };

export function SearchPicker({ label, value, groups, onChange }: {
  label: string;
  value: string;
  groups: readonly Group[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = groups.flatMap(group => group.options).find(([key]) => key === value);
  const filtered = groups.map(group => ({ ...group, options: group.options.filter(([key, name]) =>
    `${name} ${key}`.toLowerCase().includes(query.trim().toLowerCase())) })).filter(group => group.options.length);
  const options = filtered.flatMap(group => group.options);
  useEffect(() => {
    if (open) listRef.current?.querySelector(`[id="${id}-option-${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);
  function choose(key: string) {
    onChange(key);
    setOpen(false);
    setQuery("");
    setActive(0);
  }
  let offset = 0;
  return <div className="search-picker" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <label className="lab" htmlFor={id}>{label}</label>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
      aria-activedescendant={open && options[active] ? `${id}-option-${active}` : undefined}
      autoComplete="off" value={open ? query : selected?.[1] || value}
      placeholder="Название или Minecraft ID…"
      onFocus={() => { setOpen(true); setQuery(""); setActive(0); }}
      onClick={() => { if (!open) { setOpen(true); setQuery(""); setActive(0); } }}
      onChange={event => { setQuery(event.target.value); setOpen(true); setActive(0); }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          setActive(current => Math.max(0, Math.min(options.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))));
        }
        if (event.key === "Enter" && open && options[active]) { event.preventDefault(); choose(options[active][0]); }
      }} />
    {open ? <div ref={listRef} className="search-results" id={`${id}-list`} role="listbox" aria-label={label}>
      {filtered.map(group => <div role="group" aria-label={group.name} key={group.name}>
        <div className="search-group">{group.name}</div>
        {group.options.map(([key, name]) => {
          const index = offset++;
          return <button type="button" role="option" id={`${id}-option-${index}`} aria-selected={key === value}
            className={active === index ? "active" : ""} key={key} tabIndex={-1}
            onMouseDown={event => event.preventDefault()} onClick={() => choose(key)}>
            <span>{name}</span><small>{key}</small>
          </button>;
        })}
      </div>)}
      {!options.length ? <p className="hint">Ничего не найдено. Попробуй другое название или ID.</p> : null}
    </div> : null}
  </div>;
}
