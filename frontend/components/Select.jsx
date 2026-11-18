'use client';
import { Children, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function Select({ children, value, defaultValue = '', onChange, name, id, className = '', disabled = false, required = false, ...accessibility }) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const [localValue, setLocalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState(null);
  const [invalid, setInvalid] = useState(false);
  const trigger = useRef(null);
  const source = useRef(null);
  const menu = useRef(null);
  const typeahead = useRef({ text: '', time: 0 });
  const options = Children.toArray(children).filter(child => child?.type === 'option').map(child => ({ value: String(child.props.value ?? ''), label: Children.toArray(child.props.children).join(''), disabled: !!child.props.disabled }));
  const selectedValue = String(value === undefined ? localValue : value);
  const selectedIndex = options.findIndex(option => option.value === selectedValue);
  const selected = options[selectedIndex];
  const listId = selectId + '-listbox';
  const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);

  function reveal(index = selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : enabled[0] ?? -1) {
    if (disabled) return;
    setActive(index); setOpen(true);
  }
  function choose(index) {
    const option = options[index];
    if (!option || option.disabled || !source.current?.isConnected) return;
    source.current.value = option.value;
    source.current.dispatchEvent(new Event('change', { bubbles: true }));
    setInvalid(false); setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }
  function keydown(event) {
    if (disabled) return;
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const current = enabled.indexOf(active);
      const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1) : enabled[Math.max(0, Math.min(enabled.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)))];
      if (!open) reveal(event.key === 'Home' || event.key === 'End' ? next : undefined);
      else setActive(next ?? -1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(active); else reveal();
    } else if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const text = (now - typeahead.current.time < 600 ? typeahead.current.text : '') + event.key.toLocaleLowerCase('vi');
      typeahead.current = { text, time: now };
      const matched = enabled.find(index => options[index].label.toLocaleLowerCase('vi').startsWith(text));
      if (matched !== undefined) { event.preventDefault(); if (open) setActive(matched); else choose(matched); }
    }
  }

  useLayoutEffect(() => {
    const element = trigger.current;
    if (!open || !element) return;
    let disposed = false;
    function place() {
      if (disposed || !element.isConnected) return;
      const bounds = element.getBoundingClientRect();
      const viewport = window.visualViewport;
      const height = viewport?.height || window.innerHeight;
      const width = viewport?.width || window.innerWidth;
      const offsetTop = viewport?.offsetTop || 0;
      const offsetLeft = viewport?.offsetLeft || 0;
      const below = height + offsetTop - bounds.bottom - 12;
      const above = bounds.top - offsetTop - 12;
      const desired = Math.min(240, options.length * 37 + 8);
      const upwards = below < desired && above > below;
      const maxHeight = Math.max(0, Math.min(240, upwards ? above : below));
      const menuWidth = Math.min(bounds.width, width - 24);
      setPosition({ left: Math.max(offsetLeft + 12, Math.min(bounds.left, width + offsetLeft - menuWidth - 12)), top: upwards ? undefined : bounds.bottom + 4, bottom: upwards ? window.innerHeight - bounds.top + 4 : undefined, width: menuWidth, maxHeight });
    }
    function outside(event) { if (!disposed && !element.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false); }
    function scroll(event) { if (!menu.current?.contains(event.target)) place(); }
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', scroll, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', scroll, true);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [open, options.length]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => { if (open && active >= 0) menu.current?.querySelector('[data-index="' + active + '"]')?.scrollIntoView({ block: 'nearest' }); }, [active, open]);

  return <div className={'custom-select ' + className.replace(/\bselect\b/g, '').trim()}>
    <select ref={source} className="custom-select-source" name={name} value={selectedValue} disabled={disabled} required={required} tabIndex={-1} aria-hidden="true" onChange={event => { setLocalValue(event.target.value); onChange?.(event); }} onInvalid={event => { event.preventDefault(); setInvalid(true); trigger.current.focus(); reveal(); }}>{children}</select>
    <button ref={trigger} id={selectId} type="button" className="custom-select-trigger" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open && active >= 0 ? listId + '-' + active : undefined} aria-required={required || undefined} {...accessibility} aria-invalid={accessibility['aria-invalid'] || invalid || undefined} disabled={disabled} title={selected?.label} onClick={() => open ? setOpen(false) : reveal()} onKeyDown={keydown}>
      <span className="custom-select-value">{selected?.label || 'Chọn giá trị'}</span>
      <span className="custom-select-chevron" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m7 7 3-3 3 3M7 13l3 3 3-3" /></svg></span>
    </button>
    {open && position && createPortal(<div ref={menu} className="custom-select-menu" role="listbox" id={listId} aria-label={accessibility['aria-label']} aria-labelledby={accessibility['aria-labelledby'] || (!accessibility['aria-label'] ? selectId : undefined)} style={position} onMouseDown={event => event.preventDefault()}>
      {options.map((option, index) => <button type="button" role="option" tabIndex={-1} className={'custom-select-option' + (index === selectedIndex ? ' is-selected' : '') + (index === active ? ' is-active' : '')} key={option.value} id={listId + '-' + index} data-index={index} data-value={option.value} aria-selected={index === selectedIndex} aria-disabled={option.disabled || undefined} disabled={option.disabled} title={option.label} onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={() => choose(index)}>
        {index === selectedIndex && <span className="custom-select-check" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 10 4 4 8-8" /></svg></span>}
        <span className="custom-select-option-label">{option.label}</span>
      </button>)}
    </div>, document.body)}
  </div>;
}
