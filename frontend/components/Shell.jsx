'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, initials } from '../lib/client';
import Icon from './Icons';

const Context = createContext(null);
export const useSession = () => useContext(Context);
const adminNav = [['dashboard', 'Tổng quan'], ['students', 'Học sinh'], ['classes', 'Lớp học'], ['subjects', 'Môn học'], ['quizzes', 'Đề kiểm tra'], ['questions', 'Ngân hàng câu hỏi'], ['assignments', 'Giao bài'], ['results', 'Kết quả']];
const studentNav = [['dashboard', 'Tổng quan'], ['assignments', 'Bài được giao'], ['results', 'Kết quả của tôi']];

export default function Shell({ user: initialUser, children }) {
  const [user, setUser] = useState(initialUser);
  const [active, setActive] = useState(null);
  const [menu, setMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const sessionClosing = useRef(false);
  const activeRequest = useRef(null);
  const [toast, setToast] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const header = useRef(null);
  const sidebar = useRef(null);
  const mobileToggle = useRef(null);
  const account = useRef(null);
  const accountToggle = useRef(null);
  const isAdmin = user.role === 'admin';
  const prefix = isAdmin ? 'admin' : 'user';
  const nav = isAdmin ? adminNav : studentNav;
  const [, , resource, detail] = pathname.split('/');
  const inAttempt = pathname.includes('/attempt/');
  const current = nav.find(([key]) => resource === key);
  const pageLabel = pathname.includes('/profile') ? 'Hồ sơ cá nhân' : current?.[1] || 'Quizify';
  const quizTab = resource === 'quizzes' ? { drafts: 'Nháp', published: 'Đã xuất bản', archived: 'Lưu trữ', new: 'Tạo đề' }[detail] : null;
  const sectionLabel = inAttempt ? 'Làm bài' : pathname.includes('/history') ? 'Chi tiết bài kiểm tra' : quizTab || (detail ? resource === 'questions' ? 'Chi tiết câu hỏi' : detail === 'new' ? 'Thêm mới' : 'Chi tiết' : null);
  const notify = useCallback((message, error = false) => setToast({ message, error }), []);
  const refreshActive = useCallback(async () => {
    if (isAdmin || sessionClosing.current) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    try { const attempt = await api('/user/attempts/active', { signal: controller.signal }); if (!controller.signal.aborted) setActive(attempt); }
    catch { if (!controller.signal.aborted) setActive(null); }
  }, [isAdmin]);
  useEffect(() => () => activeRequest.current?.abort(), []);
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    let disposed = false;
    const measure = () => { if (!disposed && element.isConnected) document.documentElement.style.setProperty('--app-header-height', element.getBoundingClientRect().height + 'px'); };
    const observer = new ResizeObserver(measure);
    observer.observe(element); measure();
    return () => { disposed = true; observer.disconnect(); document.documentElement.style.removeProperty('--app-header-height'); };
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => { setNarrow(media.matches); setMobileOpen(false); };
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem('quizify-sidebar-' + prefix) === 'collapsed'); } catch {}
  }, [prefix]);
  useEffect(() => { refreshActive(); }, [pathname, refreshActive]);
  useEffect(() => { if (!active) return; const timer = setInterval(refreshActive, 10000); return () => clearInterval(timer); }, [active, refreshActive]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 5000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { setMenu(false); setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menu) return;
    account.current?.querySelector('a')?.focus();
    const pointer = event => { if (!account.current?.contains(event.target)) setMenu(false); };
    const key = event => { if (event.key === 'Escape') { setMenu(false); accountToggle.current?.focus(); } };
    document.addEventListener('pointerdown', pointer); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', key); };
  }, [menu]);
  useEffect(() => {
    if (!mobileOpen || !narrow) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.current.querySelector('.sidebar-close').focus();
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileOpen(false); }
      if (event.key !== 'Tab') return;
      const controls = [...sidebar.current.querySelectorAll('a, button')].filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', key); mobileToggle.current?.focus(); };
  }, [mobileOpen, narrow]);
  function collapse() {
    const next = !collapsed; setCollapsed(next);
    try { localStorage.setItem('quizify-sidebar-' + prefix, next ? 'collapsed' : 'expanded'); } catch {}
  }
  async function logout() {
    if (sessionClosing.current) return;
    sessionClosing.current = true;
    setMenu(false);
    setLoggingOut(true);
    activeRequest.current?.abort(); setActive(null);
    try { await api('/auth/logout', { method: 'POST' }); router.replace(isAdmin ? '/admin-login' : '/user-login'); }
    catch (error) { sessionClosing.current = false; setLoggingOut(false); refreshActive(); notify(error.message, true); }
  }
  return <Context.Provider value={{ user, setUser, active, refreshActive, notify }}>
    <div className={'shell workspace-shell' + (collapsed ? ' sidebar-collapsed' : '') + (mobileOpen ? ' navigation-open' : '')}>
      <a className="skip-link" href="#main-content">Đi đến nội dung</a>
      <aside ref={sidebar} id="workspace-navigation" className="workspace-sidebar" aria-label="Điều hướng Quizify" role={narrow && mobileOpen ? 'dialog' : undefined} aria-modal={narrow && mobileOpen ? true : undefined}>
        <div className="sidebar-brand-row"><Link className="workspace-brand" href={'/' + prefix + '/dashboard'} aria-label={isAdmin ? 'Quizify Admin' : 'Quizify'}><img src="/logo.svg" alt="" width="40" height="40" /><span className="sidebar-copy"><strong>{isAdmin ? 'Quizify Admin' : 'Quizify'}</strong><small>{isAdmin ? 'Không gian quản lý' : 'Không gian học tập'}</small></span></Link><button type="button" className="icon-btn sidebar-close" aria-label="Đóng menu điều hướng" onClick={() => setMobileOpen(false)}><Icon name="close" /></button></div>
        <p className="navigation-caption sidebar-copy">{isAdmin ? 'Quản lý' : 'Học tập'}</p>
        <nav className="workspace-nav" aria-label="Menu chính">{nav.map(([key, label]) => {
          const selected = current?.[0] === key;
          return <Link key={key} className={'nav-link workspace-nav-link' + (selected ? ' active' : '')} href={'/' + prefix + '/' + key} aria-current={selected ? 'page' : undefined} title={collapsed ? label : undefined} onClick={() => setMobileOpen(false)}><Icon name={key} /><span className="sidebar-copy">{label}</span></Link>;
        })}</nav>
        <div className="sidebar-note sidebar-copy"><span className="sidebar-note-label">{isAdmin ? 'Kiểm tra lớp học' : 'Học tập cùng Quizify'}</span><p>{isAdmin ? 'Tạo đề, giao bài và theo dõi kết quả trong cùng một không gian.' : 'Bài làm được lưu tự động. Bạn có thể xem lại kết quả sau khi nộp.'}</p></div>
        <button type="button" className="sidebar-collapse" aria-expanded={!collapsed} aria-controls="workspace-navigation" aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'} title={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'} onClick={collapse}><Icon name={collapsed ? 'expand' : 'collapse'} /><span className="sidebar-copy">Thu gọn thanh bên</span></button>
      </aside>
      {mobileOpen && <button className="navigation-backdrop" type="button" aria-label="Đóng lớp phủ điều hướng" tabIndex={-1} onClick={() => setMobileOpen(false)} />}
      <header ref={header} className="app-header workspace-topbar"><button ref={mobileToggle} type="button" className="icon-btn mobile-menu-button" aria-label="Mở menu điều hướng" aria-expanded={mobileOpen} aria-controls="workspace-navigation" onClick={() => setMobileOpen(!mobileOpen)}><Icon name="menu" /></button><div className="workspace-breadcrumb"><span className="breadcrumb-root">{isAdmin ? 'Quản lý' : 'Học tập'}</span><span className="breadcrumb-separator" aria-hidden="true">/</span><strong>{pageLabel}</strong>{sectionLabel && <><span className="breadcrumb-separator" aria-hidden="true">/</span><span className="breadcrumb-detail">{sectionLabel}</span></>}</div><div className="header-actions">{active && !inAttempt && <Link className="btn secondary active-attempt-link" href={'/user/assignments/' + active.assignmentId + '/attempt/' + active.id} aria-label="Tiếp tục làm bài"><Icon name="play" /><span>Tiếp tục làm bài</span></Link>}<div ref={account} className={'avatar-wrap' + (menu ? ' open' : '')}><button ref={accountToggle} type="button" className="avatar-button" aria-label="Menu tài khoản" aria-controls="account-menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><span className="avatar">{initials(user.fullName)}</span><span className="account-name">{user.fullName}</span><Icon name="chevron" /></button>{menu && <div className="avatar-menu" id="account-menu"><div className="account-menu-heading"><strong>{user.fullName}</strong><span>{isAdmin ? 'Giáo viên / Quản trị viên' : 'Học sinh'}</span></div><Link className="menu-item" href={'/' + prefix + '/profile'}><Icon name="profile" />Hồ sơ</Link><button type="button" className="menu-item" onClick={logout}><Icon name="logout" />Đăng xuất</button></div>}</div></div></header>
      <main id="main-content" tabIndex={-1} className="app-main" inert={narrow && mobileOpen ? true : undefined}><div className="main-inner">{loggingOut ? <p role="status">Đang đăng xuất…</p> : children}</div></main>
      <footer className="app-footer" inert={narrow && mobileOpen ? true : undefined}><div className="footer-inner"><span>{isAdmin ? 'Quizify Admin' : 'Quizify'} <span className="footer-description">· Kiểm tra lớp học</span></span><span>© 2026 Quizify</span></div></footer>
      {toast && <div className="toast-root"><div className={'toast' + (toast.error ? ' error' : '')} role="alert">{toast.message}</div></div>}
    </div>
  </Context.Provider>;
}
