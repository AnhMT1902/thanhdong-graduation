'use client';
import { useEffect, useRef, useId, useState, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import { stateLabels } from '../lib/client';
import Icon from './Icons';
import Select from './Select';

let modalLocks = 0;
let originalOverflow;
function lockModalScroll() {
  if (modalLocks === 0) originalOverflow = { body: document.body.style.overflow, root: document.documentElement.style.overflow };
  modalLocks += 1;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  return () => {
    modalLocks -= 1;
    if (modalLocks === 0) {
      document.body.style.overflow = originalOverflow.body;
      document.documentElement.style.overflow = originalOverflow.root;
    }
  };
}

export function Badge({ state, children }) { const type = ['inactive', 'overdue', 'cancelled'].includes(state) ? 'error' : state === 'in_progress' ? 'warning' : ['not_started', 'draft', 'archived', 'locked', 'upcoming'].includes(state) ? 'gray' : state === 'easy' ? 'success' : state === 'medium' ? 'warning' : state === 'hard' ? 'error' : ''; return <span className={`badge ${type}`}>{children || { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' }[state] || stateLabels[state] || state}</span>; }
export function Heading({ title, subtitle, action }) { return <div className="page-heading row between"><div><h1 className="page-title">{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div>{action}</div>; }
export function Empty({ title = 'Chưa có dữ liệu', description = 'Dữ liệu sẽ hiển thị khi có bản ghi phù hợp.' }) { return <div className="empty-state"><span className="empty-state-icon"><Icon name="empty" /></span><div><h3>{title}</h3><p>{description}</p></div></div>; }
export function Loading() { return <div className="page-loader" role="status"><span className="spinner" /><span>Đang tải dữ liệu…</span></div>; }
export function LoadState({ resource, children }) { if (resource.loading) return <Loading />; if (resource.error) return <div className="panel panel-body" role="alert"><p>{resource.error}</p><button className="btn secondary" onClick={resource.reload}>Thử lại</button></div>; return children(resource.data); }
export function Field({ label, children, error }) {
  const fieldId = useId();
  const control = (['input', 'select', 'textarea'].includes(children.type) || children.type === Select);
  return <div className="field"><label id={`${fieldId}-label`} htmlFor={control ? fieldId : undefined}>{label}</label>{control ? cloneElement(children, { id: fieldId, 'aria-invalid': error ? true : undefined, 'aria-describedby': [children.props['aria-describedby'], error && `${fieldId}-error`].filter(Boolean).join(' ') || undefined }) : <div role="group" aria-labelledby={`${fieldId}-label`}>{children}</div>}{error && <p className="small error-text" id={`${fieldId}-error`} role="alert">{error}</p>}</div>;
}
export function DataTable({ headers, rows, sortFields = [], sorting, className = '', columnWidths, label }) {
  return <div className="table-wrap" role={label ? "region" : undefined} aria-label={label} tabIndex={label ? 0 : undefined}><table className={"table " + className}>{columnWidths && <colgroup>{columnWidths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>}<thead><tr>{headers.map((header, index) => {
    const field = sortFields[index];
    const ascending = sorting?.sort === field + '_asc';
    const descending = sorting?.sort === field + '_desc';
    return <th key={header} scope="col" className={field ? 'table-header--sortable' + (ascending || descending ? ' table-header--active' : '') : 'table-header--static'} aria-sort={field ? ascending ? 'ascending' : descending ? 'descending' : 'none' : undefined}>
      {field ? <button type="button" className="sort-button" onClick={() => sorting.onSort(field + (ascending ? '_desc' : '_asc'))}><span>{header}</span><svg className="sort-button__arrow" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{ascending ? <path d="m6 12 4-4 4 4" /> : descending ? <path d="m6 8 4 4 4-4" /> : <path d="m6 7 4-4 4 4M6 13l4 4 4-4" />}</svg></button> : header}
    </th>;
  })}</tr></thead><tbody>{rows.length ? rows.map((cells, index) => <tr key={index}>{cells.map((cell, column) => <td key={column}>{cell}</td>)}</tr>) : <tr><td className="table-empty-cell" colSpan={headers.length}><Empty title="Không có dữ liệu phù hợp" description="Thử đổi từ khóa hoặc bỏ bớt điều kiện lọc." /></td></tr>}</tbody></table></div>;
}
export function Pagination({ data, onPage, onPageSize }) {
  if (!data) return null;
  const pages = Math.max(1, data.totalPages);
  const start = Math.max(1, Math.min(data.page - 2, pages - 4));
  const visible = Array.from({ length: Math.min(5, pages) }, (_, index) => start + index);
  return <section className="pagination pagination-shell"><p className="pagination-summary">{data.total ? (data.page - 1) * data.pageSize + 1 : 0}–{Math.min(data.total, data.page * data.pageSize)} / {data.total} bản ghi <span>· Trang {data.page}/{pages} · {data.pageSize} / trang</span></p><div className="pagination-controls">{onPageSize && <Select className="select compact" aria-label="Số dòng mỗi trang" value={data.pageSize} onChange={event => onPageSize(Number(event.target.value))}>{[4, 8, 10, 20, 50].map(size => <option key={size} value={size}>{size} / trang</option>)}</Select>}<nav className="pagination-nav" aria-label="Phân trang"><button type="button" className="page-chip pagination-nav__button" aria-label="Trang trước" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Trước</button>{visible.map(page => <button type="button" key={page} className={'page-chip' + (page === data.page ? ' active' : '')} aria-label={'Trang ' + page} aria-current={page === data.page ? 'page' : undefined} onClick={() => { if (page !== data.page) onPage(page); }}>{page}</button>)}<button type="button" className="page-chip pagination-nav__button" aria-label="Trang sau" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>Sau</button></nav></div></section>;
}
export function Modal({ title, children, onClose, variant, tone = 'danger', descriptionId, canClose = true, guardChanges = true }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  const baseline = useRef(null);
  const discardFocus = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [discard, setDiscard] = useState(false);
  const dismissible = useRef(canClose);
  dismissible.current = canClose;
  const readDraft = () => {
    const controls = dialog.current?.querySelectorAll('form input,form select,form textarea');
    return controls?.length ? JSON.stringify([...controls].map(element => [element.name, element.value, element.checked])) : null;
  };
  const requestClose = () => {
    if (!dismissible.current) return;
    if (guardChanges && baseline.current !== null && readDraft() !== baseline.current) { discardFocus.current = document.activeElement; setDiscard(true); return; }
    close.current();
  };
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const previous = document.activeElement;
    const current = dialog.current;
    const unlockScroll = lockModalScroll();
    const focusable = () => [...current.querySelectorAll('button:not([tabindex="-1"]),input:not([aria-hidden="true"]),select:not([aria-hidden="true"]),textarea,a[href]')].filter(element => !element.disabled && element.getClientRects().length);
    baseline.current = readDraft();
    const observer = new MutationObserver(() => { if (baseline.current === null) baseline.current = readDraft(); });
    observer.observe(current, { childList: true, subtree: true });
    (current.querySelector('.confirm-cancel') || focusable()[0])?.focus({ preventScroll: true });
    const handle = event => {
      if (event.key === 'Escape' && current.querySelector('[role="combobox"][aria-expanded="true"]')) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); requestClose(); }
      if (event.key === 'Tab') {
        const elements = focusable(); const first = elements[0]; const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    current.addEventListener('keydown', handle);
    return () => {
      current.removeEventListener('keydown', handle);
      observer.disconnect();
      baseline.current = null;
      unlockScroll();
      requestAnimationFrame(() => { if (previous?.isConnected && previous !== document.body && !previous.closest('[inert]')) previous.focus({ preventScroll: true }); });
    };
  }, [mounted]);
  if (!mounted) return null;
  return createPortal(<div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) { event.preventDefault(); requestClose(); } }}><section ref={dialog} className={"modal" + (variant === "confirm" ? " confirm" : variant === "assignment" ? " modal--assignment" : "")} role="dialog" aria-modal="true" aria-label={title} aria-describedby={descriptionId} inert={discard}><div className="modal-header row between">{variant === "confirm" && <span className={"danger-icon" + (tone === "default" ? " danger-icon--default" : "")} aria-hidden="true"><Icon name="warning" /></span>}<h2 className="section-title">{title}</h2><button type="button" className="icon-btn confirm-close" aria-label="Đóng" disabled={!canClose} onClick={requestClose}>×</button></div><div className="modal-body">{children}</div></section>{discard && <Confirm title="Bỏ thay đổi chưa lưu?" message="Bạn có thay đổi chưa lưu. Nếu đóng, những thay đổi này sẽ bị mất." cancelLabel="Tiếp tục chỉnh sửa" confirmLabel="Bỏ thay đổi" onClose={() => { setDiscard(false); requestAnimationFrame(() => { if (discardFocus.current?.isConnected) discardFocus.current.focus({ preventScroll: true }); }); }} onConfirm={() => close.current()} />}</div>, document.body);
}
export function Confirm({ title, message, onConfirm, onClose, busy = false, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', tone = 'danger' }) {
  const descriptionId = useId();
  return <Modal title={title} onClose={onClose} variant="confirm" tone={tone} descriptionId={descriptionId} canClose={!busy} guardChanges={false}><p className="confirm-description" id={descriptionId}>{message}</p><div className="modal-actions"><button type="button" className="btn confirm-cancel" disabled={busy} onClick={onClose}>{cancelLabel}</button><button type="button" className={'btn confirm-submit confirm-submit--' + tone} disabled={busy} onClick={onConfirm}>{busy ? 'Đang xử lý…' : confirmLabel}</button></div></Modal>;
}
export function Stat({ label, value }) { return <div className="card stat-card"><div className="small muted">{label}</div><div className="stat-value">{value ?? '—'}</div></div>; }
