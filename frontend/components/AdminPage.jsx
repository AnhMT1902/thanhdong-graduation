'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, useLoad, useCatalog, date, score, time } from '../lib/client';
import { useSession } from './Shell';
import { Heading, DataTable, Badge, Pagination, LoadState, Modal, Confirm, Stat, Empty } from './ui';
import { StudentForm, CatalogForm, QuestionForm, QuizForm, AssignmentForm } from './AdminForms';
import Profile from './Profile';
import Select from './Select';

function useList(path, defaultSort = 'latest') {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState(defaultSort);
  const [search, setSearch] = useState('');
  const resource = useLoad(`${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=${pageSize}&sort=${sort}${search ? `&q=${encodeURIComponent(search)}` : ''}`);
  const pagination = data => <Pagination data={data} onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1); }} />;
  const sorting = { sort, onSort: next => { setSort(next); setPage(1); } };
  const searching = <input className="input" aria-label="Tìm trong bảng" placeholder="Tìm tên, mã hoặc nội dung…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />;
  return { resource, pagination, setPage, sorting, searching, hasSearch: !!search, resetSearch: () => { setSearch(''); setPage(1); } };
}

function FilterControl({ label, value, onChange, options, placeholder }) {
  return <Select className="select compact" aria-label={label} value={value} onChange={event => onChange(event.target.value)}><option value="">{placeholder}</option>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>;
}
const activeOptions = [['active', 'Hoạt động'], ['inactive', 'Vô hiệu hóa']];

function useActions(resource) {
  const { notify } = useSession();
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(null);
  async function run(path, method = 'DELETE', body) {
    setBusy(true);
    try { await api(path, { method, body }); notify('Đã cập nhật dữ liệu'); setConfirmation(null); resource.reload(); }
    catch (error) { notify(error.message, true); }
    finally { setBusy(false); }
  }
  const confirm = (title, message, path, method = 'DELETE', options = {}) => setConfirmation({ title, message, path, method, ...options });
  const close = () => setEditor(null);
  const saved = () => { setEditor(null); resource.reload(); };
  const confirmationUi = confirmation && <Confirm title={confirmation.title} message={confirmation.message} onClose={() => setConfirmation(null)} onConfirm={() => run(confirmation.path, confirmation.method, confirmation.body)} busy={busy} confirmLabel={confirmation.confirmLabel} tone={confirmation.tone} />;
  return { editor, setEditor, confirm, close, saved, confirmationUi };
}

function Dashboard() {
  const resource = useLoad('/admin/dashboard');
  return <div className="stack"><Heading title="Tổng quan" subtitle="Quản lý kiểm tra trắc nghiệm cho lớp học" /><LoadState resource={resource}>{data => <><div className="grid grid-4"><Stat label="Học sinh hoạt động" value={data.students} /><Stat label="Lớp học" value={data.classes} /><Stat label="Môn học" value={data.subjects} /><Stat label="Đề kiểm tra" value={data.quizzes} /></div><div className="grid grid-3"><Stat label="Giao bài hoạt động" value={data.assignments} /><Stat label="Lượt đã nộp" value={data.submitted} /><Stat label="Điểm trung bình /10" value={data.averageScore === null ? '—' : score(data.averageScore)} /></div><section className="panel"><div className="panel-header"><h2 className="section-title">Thao tác nhanh</h2></div><div className="panel-body row"><Link className="btn primary" href="/admin/students/new">Thêm học sinh</Link><Link className="btn secondary" href="/admin/quizzes/new">Tạo đề kiểm tra</Link><Link className="btn secondary" href="/admin/assignments">Giao bài</Link><Link className="btn secondary" href="/admin/results">Xem kết quả</Link></div></section></>}</LoadState></div>;
}

function Students() {
  const [search, setSearch] = useState('');
  const classes = useCatalog('/admin/classes');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');
  const { resource, pagination, setPage, sorting } = useList(`/admin/students?q=${encodeURIComponent(search)}&classId=${classId}&status=${status}`);
  const actions = useActions(resource);
  return <div className="stack"><Heading title="Quản lý học sinh" subtitle="Tạo tài khoản thủ công và gán lớp chính" action={<Link className="btn primary" href="/admin/students/new">Thêm học sinh</Link>} /><div className="toolbar"><input className="input" aria-label="Tìm học sinh" placeholder="Tên, mã hoặc email…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /><Select className="select compact" aria-label="Lọc lớp" value={classId} onChange={event => { setClassId(event.target.value); setPage(1); }}><option value="">Tất cả lớp</option><option value="unassigned">Chưa gán lớp</option>{classes.data?.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><FilterControl label="Lọc trạng thái" placeholder="Tất cả trạng thái" value={status} onChange={value => { setStatus(value); setPage(1); }} options={activeOptions} /><button type="button" className="btn secondary filter-reset" disabled={!search && !classId && !status} onClick={() => { setSearch(''); setClassId(''); setStatus(''); setPage(1); }}>Xóa bộ lọc</button></div><LoadState resource={resource}>{data => <section className="panel"><DataTable sorting={sorting} sortFields={['studentCode', 'fullName', 'email', 'className', 'status']} headers={['Mã học sinh', 'Họ và tên', 'Email', 'Lớp', 'Trạng thái', 'Thao tác']} rows={data.items.map(item => [item.studentCode, <Link className="link-button" key={item.id} href={`/admin/students/${item.id}`}>{item.fullName}</Link>, item.email, item.className || 'Chưa gán', <Badge key={item.id} state={item.status} />, <div className="table-actions" key={item.id}><button className={item.status === 'inactive' ? 'btn secondary' : 'btn danger-outline'} aria-label={`${item.status === 'inactive' ? 'Kích hoạt lại' : 'Vô hiệu hóa'} ${item.studentCode}`} onClick={() => item.status === 'inactive' ? actions.confirm('Kích hoạt lại học sinh', `Kích hoạt lại ${item.fullName}? Học sinh có thể đăng nhập lại bằng tài khoản hiện có. Lịch sử điểm được giữ nguyên.`, `/admin/students/${item.id}`, 'PATCH', { body: { status: 'active' }, confirmLabel: 'Kích hoạt lại', tone: 'default' }) : actions.confirm('Vô hiệu hóa học sinh', `Vô hiệu hóa ${item.fullName}? Học sinh sẽ bị đăng xuất và không thể đăng nhập. Lịch sử điểm được giữ nguyên.`, `/admin/students/${item.id}`, 'DELETE', { confirmLabel: 'Vô hiệu hóa' })}>{item.status === 'inactive' ? 'Kích hoạt lại' : 'Vô hiệu hóa'}</button></div>])} />{pagination(data)}</section>}</LoadState>{actions.confirmationUi}</div>;
}

function StudentDetail({ recordId }) {
  const router = useRouter();
  const resource = useLoad(`/admin/students/${recordId}`);
  return <div className="stack"><Heading title="Chi tiết và chỉnh sửa học sinh" action={<Link className="btn secondary" href="/admin/students">Danh sách học sinh</Link>} /><LoadState resource={resource}>{data => <section className="panel panel-body"><StudentForm initial={data} onSaved={() => { router.push('/admin/students'); router.refresh(); }} /></section>}</LoadState></div>;
}
function NewStudent() {
  const router = useRouter();
  return <div className="stack"><Heading title="Thêm học sinh" subtitle="Tạo tài khoản học sinh thủ công" action={<Link className="btn secondary" href="/admin/students">Danh sách học sinh</Link>} /><section className="panel panel-body"><StudentForm onSaved={() => router.push('/admin/students')} /></section></div>;
}

function Catalog({ kind }) {
  const [status, setStatus] = useState('');
  const [grade, setGrade] = useState('');
  const catalog = useCatalog(`/admin/${kind}`);
  const grades = [...new Set((catalog.data?.items || []).map(item => item.grade || item.gradeScope).filter(Boolean))].sort((first, second) => first.localeCompare(second, 'vi', { numeric: true }));
  const { resource, pagination, setPage, sorting, searching, resetSearch, hasSearch } = useList(`/admin/${kind}?status=${status}&grade=${encodeURIComponent(grade)}`, 'name_asc');
  const actions = useActions(resource);
  const isClass = kind === 'classes';
  return <div className="stack"><Heading title={isClass ? 'Lớp học' : 'Môn học'} subtitle={isClass ? 'Quản lý lớp, môn học và danh sách học sinh' : 'Danh mục môn học cho đề kiểm tra'} action={<button className="btn primary" onClick={() => actions.setEditor({})}>{isClass ? 'Thêm lớp' : 'Thêm môn'}</button>} /><div className="toolbar">{searching}<FilterControl label="Lọc khối" placeholder="Tất cả khối" value={grade} onChange={value => { setGrade(value); setPage(1); }} options={grades.map(value => [value, value])} /><FilterControl label="Lọc trạng thái" placeholder="Tất cả trạng thái" value={status} onChange={value => { setStatus(value); setPage(1); }} options={activeOptions} /><button type="button" className="btn secondary filter-reset" disabled={!hasSearch && !status && !grade} onClick={() => { resetSearch(); setStatus(''); setGrade(''); }}>Xóa bộ lọc</button></div><LoadState resource={resource}>{data => <section className="panel"><DataTable sorting={sorting} sortFields={['code', 'name', isClass ? 'grade' : 'gradeScope', ...(isClass ? ['studentCount'] : []), 'status']} headers={['Mã', 'Tên', 'Khối', ...(isClass ? ['Học sinh'] : []), 'Trạng thái', 'Thao tác']} rows={data.items.map(item => [item.code, <Link key={item.id} className="link-button" href={`/admin/${kind}/${item.id}`}>{item.name}</Link>, item.grade || item.gradeScope || '—', ...(isClass ? [item.studentCount] : []), <Badge state={item.status} key={item.id} />, <div className="table-actions" key={item.id}><button className="btn danger-outline" aria-label={`Xóa ${item.name}`} onClick={() => actions.confirm('Xác nhận xóa', `Xóa ${item.name}? Dữ liệu đang được sử dụng sẽ không thể xóa.`, `/admin/${kind}/${item.id}`)}>Xóa</button></div>])} />{pagination(data)}</section>}</LoadState>{actions.editor && <Modal title={`${actions.editor.id ? 'Chỉnh sửa' : 'Thêm'} ${isClass ? 'lớp học' : 'môn học'}`} onClose={actions.close}><CatalogForm kind={kind} initial={actions.editor} onSaved={actions.saved} /></Modal>}{actions.confirmationUi}</div>;
}

function ClassDetail({ recordId }) {
  const resource = useLoad(`/admin/classes/${recordId}`);
  const candidates = useCatalog('/admin/students');
  const actions = useActions(resource);
  const [assigning, setAssigning] = useState(false);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const { notify } = useSession();
  async function assign(event) {
    event.preventDefault(); setBusy(true);
    try { await api(`/admin/classes/${recordId}/students`, { method: 'POST', body: { studentIds: selected } }); notify('Đã gán học sinh vào lớp'); setAssigning(false); setSelected([]); resource.reload(); candidates.reload(); }
    catch (error) { notify(error.message, true); }
    finally { setBusy(false); }
  }
  return <div className="stack"><LoadState resource={resource}>{data => <><Heading title={`Chi tiết lớp ${data.name}`} subtitle={`${data.code} · Khối ${data.grade}`} action={<button className="btn secondary" onClick={() => actions.setEditor(data)}>Chỉnh sửa lớp</button>} /><section className="panel"><div className="panel-header"><h2 className="section-title">Danh sách học sinh</h2><button className="btn primary" onClick={() => setAssigning(true)}>Gán học sinh</button></div><DataTable headers={['Mã', 'Họ và tên', 'Email', 'Trạng thái', 'Thao tác']} rows={data.students.map(item => [item.studentCode, <Link key={item.id} className="link-button" href={`/admin/students/${item.id}`}>{item.fullName}</Link>, item.email, <Badge key={item.id} state={item.status} />, <button key={item.id} className="btn danger-outline" onClick={() => actions.confirm('Tháo học sinh khỏi lớp', `Tháo ${item.fullName} khỏi lớp? Lịch sử lượt làm được giữ nguyên.`, `/admin/classes/${recordId}/students/${item.id}`)}>Tháo khỏi lớp</button>])} /></section></>}</LoadState>{actions.editor && <Modal title="Chỉnh sửa lớp" onClose={actions.close}><CatalogForm kind="classes" initial={actions.editor} onSaved={actions.saved} /></Modal>}{assigning && <Modal title="Gán học sinh vào lớp" onClose={() => setAssigning(false)}><form className="stack" onSubmit={assign}><p className="small muted">Gán vào lớp này thay thế lớp chính hiện tại của học sinh.</p><div className="check-list">{candidates.data?.items.filter(item => item.classId !== recordId && item.status === 'active').map(item => <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(value => value !== item.id))} />{item.studentCode} — {item.fullName} ({item.className || 'Chưa gán lớp'})</label>)}</div><button className="btn primary" disabled={busy || !selected.length}>Gán vào lớp</button></form></Modal>}{actions.confirmationUi}</div>;
}

function Questions() {
  const [subjectId, setSubjectId] = useState('');
  const subjects = useCatalog('/admin/subjects');
  const [difficulty, setDifficulty] = useState('');
  const { resource, pagination, setPage, sorting, searching, resetSearch, hasSearch } = useList(`/admin/questions?subjectId=${subjectId}&difficulty=${difficulty}`);
  const actions = useActions(resource);
  return <div className="stack"><Heading title="Ngân hàng câu hỏi" subtitle="Quản lý câu hỏi dùng trong đề kiểm tra" action={<div className="page-actions"><Link className="btn secondary" href="/admin/quizzes">Đề kiểm tra</Link><button className="btn primary" onClick={() => actions.setEditor({})}>Thêm câu hỏi</button></div>} /><div className="toolbar"><Select className="select compact" aria-label="Lọc môn học" value={subjectId} onChange={event => { setSubjectId(event.target.value); setPage(1); }}><option value="">Tất cả môn</option>{subjects.data?.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>{searching}<FilterControl label="Lọc độ khó" placeholder="Tất cả độ khó" value={difficulty} onChange={value => { setDifficulty(value); setPage(1); }} options={[['easy', 'Dễ'], ['medium', 'Trung bình'], ['hard', 'Khó']]} /><button type="button" className="btn secondary filter-reset" disabled={!hasSearch && !subjectId && !difficulty} onClick={() => { resetSearch(); setSubjectId(''); setDifficulty(''); }}>Xóa bộ lọc</button></div><LoadState resource={resource}>{data => <section className="panel"><DataTable sorting={sorting} sortFields={['content', 'subjectName', 'difficulty']} headers={['Nội dung', 'Môn', 'Độ khó', 'Lựa chọn', 'Thao tác']} rows={data.items.map(item => [<Link key={item.id} className="link-button" href={`/admin/questions/${item.id}`}>{item.content}</Link>, item.subjectName, <Badge key={item.id} state={item.difficulty} />, item.options.length, <div className="table-actions" key={item.id}><button className="btn danger-outline" aria-label={`Xóa câu ${item.content}`} onClick={() => actions.confirm('Xóa câu hỏi', 'Câu đang được dùng trong đề không thể xóa.', `/admin/questions/${item.id}`)}>Xóa</button></div>])} />{pagination(data)}</section>}</LoadState>{actions.editor && <Modal title={actions.editor.id ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi'} onClose={actions.close}><QuestionForm initial={actions.editor} onSaved={actions.saved} /></Modal>}{actions.confirmationUi}</div>;
}

function Quizzes({ status = '' }) {
  const [subjectId, setSubjectId] = useState('');
  const subjects = useCatalog('/admin/subjects');
  const { resource, pagination, setPage, sorting, searching, resetSearch, hasSearch } = useList(`/admin/quizzes?status=${status}&subjectId=${subjectId}`);
  const actions = useActions(resource);
  return <div className="stack"><Heading title="Đề kiểm tra" subtitle="Tạo đề nháp, xuất bản và lưu trữ" action={<Link className="btn primary" href="/admin/quizzes/new">Tạo đề</Link>} /><div className="row"><Link className={`btn ${!status ? 'primary' : 'secondary'}`} href="/admin/quizzes">Tất cả</Link>{[['draft', 'drafts', 'Nháp'], ['published', 'published', 'Đã xuất bản'], ['archived', 'archived', 'Lưu trữ']].map(([key, path, label]) => <Link className={`btn ${status === key ? 'primary' : 'secondary'}`} href={`/admin/quizzes/${path}`} key={key}>{label}</Link>)}<Link className="btn secondary" href="/admin/questions">Ngân hàng câu hỏi</Link></div><div className="toolbar">{searching}<FilterControl label="Lọc môn học" placeholder="Tất cả môn học" value={subjectId} onChange={value => { setSubjectId(value); setPage(1); }} options={(subjects.data?.items || []).map(item => [item.id, item.name])} /><button type="button" className="btn secondary filter-reset" disabled={!hasSearch && !subjectId} onClick={() => { resetSearch(); setSubjectId(''); }}>Xóa bộ lọc</button></div><LoadState resource={resource}>{data => <section className="panel"><DataTable sorting={sorting} sortFields={['title', 'subjectName', 'durationMinutes', 'questionCount', 'status']} headers={['Tên đề', 'Môn', 'Thời lượng', 'Số câu', 'Trạng thái', 'Thao tác']} rows={data.items.map(item => [<Link key={item.id} className="link-button" href={`/admin/quizzes/${item.id}`}>{item.title}</Link>, item.subjectName, `${item.durationMinutes} phút`, item.questionCount, <Badge key={item.id} state={item.status} />, <div className="table-actions" key={item.id}>{item.status === 'draft' && <><button className="btn secondary" aria-label={`Xuất bản ${item.title}`} onClick={() => actions.confirm('Xuất bản đề', 'Sau khi xuất bản, đề và câu hỏi được khóa chỉnh sửa.', `/admin/quizzes/${item.id}/publish`, 'POST')}>Xuất bản</button><button className="btn danger-outline" aria-label={`Xóa đề ${item.title}`} onClick={() => actions.confirm('Xóa đề nháp', `Xóa đề ${item.title}?`, `/admin/quizzes/${item.id}`)}>Xóa đề nháp</button></>}{item.status === 'published' && <button className="btn secondary" aria-label={`Lưu trữ ${item.title}`} onClick={() => actions.confirm('Lưu trữ đề', 'Ngừng mở lượt mới cho đề này; lượt và kết quả đã có được giữ.', `/admin/quizzes/${item.id}/archive`, 'POST')}>Lưu trữ</button>}{item.status === 'archived' && <span className="small muted">Chỉ xem</span>}</div>])} />{pagination(data)}</section>}</LoadState>{actions.confirmationUi}</div>;
}
function QuizDetail({ recordId }) {
  const resource = useLoad(`/admin/quizzes/${recordId}`);
  const router = useRouter();
  return <div className="stack"><Heading title="Chi tiết đề kiểm tra" action={<Link className="btn secondary" href="/admin/quizzes">Danh sách đề</Link>} /><LoadState resource={resource}>{data => <section className="panel panel-body"><QuizForm initial={data} onSaved={() => router.push('/admin/quizzes/drafts')} /></section>}</LoadState></div>;
}
function NewQuiz() {
  const router = useRouter();
  return <div className="stack"><Heading title="Tạo đề kiểm tra" subtitle="Tạo đề nháp và chọn câu hỏi theo môn" action={<Link className="btn secondary" href="/admin/quizzes">Danh sách đề</Link>} /><section className="panel panel-body"><QuizForm onSaved={() => router.push('/admin/quizzes/drafts')} /></section></div>;
}

function Assignments() {
  const [filters, setFilters] = useState({ status: '', targetType: '', classId: '', subjectId: '' });
  const { resource, pagination, setPage, sorting, searching, resetSearch, hasSearch } = useList(`/admin/assignments?${new URLSearchParams(filters)}`);
  const setFilter = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); };
  const subjects = useCatalog('/admin/subjects');
  const actions = useActions(resource);
  const classes = useCatalog('/admin/classes');
  const students = useCatalog('/admin/students');
  const classNames = new Map(classes.data?.items.map(item => [item.id, item.name]) || []);
  const studentNames = new Map(students.data?.items.map(item => [item.id, item.studentCode]) || []);
  return <div className="stack"><Heading title="Giao bài" subtitle="Giao đề đã xuất bản cho lớp hoặc từng học sinh" action={<button className="btn primary" onClick={() => actions.setEditor({})}>Giao đề</button>} /><div className="toolbar">{searching}<FilterControl label="Lọc trạng thái" placeholder="Tất cả trạng thái" value={filters.status} onChange={value => setFilter('status', value)} options={[['active', 'Hoạt động'], ['cancelled', 'Đã hủy']]} /><FilterControl label="Lọc đối tượng" placeholder="Tất cả đối tượng" value={filters.targetType} onChange={value => setFilter('targetType', value)} options={[['class', 'Giao cho lớp'], ['student', 'Giao cho học sinh']]} /><FilterControl label="Lọc lớp" placeholder="Tất cả lớp" value={filters.classId} onChange={value => setFilter('classId', value)} options={(classes.data?.items || []).map(item => [item.id, item.name])} /><FilterControl label="Lọc môn học" placeholder="Tất cả môn học" value={filters.subjectId} onChange={value => setFilter('subjectId', value)} options={(subjects.data?.items || []).map(item => [item.id, item.name])} /><button type="button" className="btn secondary filter-reset" disabled={!hasSearch && !Object.values(filters).some(Boolean)} onClick={() => { resetSearch(); setFilters({ status: '', targetType: '', classId: '', subjectId: '' }); }}>Xóa bộ lọc</button></div><LoadState resource={resource}>{data => <section className="panel"><DataTable className="assignment-table" label="Danh sách đợt giao bài" columnWidths={['18%', '20%', '13%', '13%', '10%', '12%', '14%']} sorting={sorting} sortFields={['title', 'targetType', 'openAt', 'dueAt', 'maxAttempts', 'status']} headers={['Đề kiểm tra', 'Đối tượng', 'Giờ mở', 'Hạn nộp', 'Lượt tối đa', 'Trạng thái', 'Thao tác']} rows={data.items.map(item => [<Link key={item.id} className="link-button" href={`/admin/assignments/${item.id}`}>{item.title}</Link>, item.targetType === 'class' ? `Lớp: ${item.classIds.map(recordId => classNames.get(recordId) || '…').join(', ')}` : `Học sinh: ${item.studentIds.map(recordId => studentNames.get(recordId) || '…').join(', ')}`, date(item.openAt), date(item.dueAt), item.maxAttempts, <Badge key={item.id} state={item.status} />, <div className="table-actions" key={item.id}><button className="btn danger-outline" aria-label={`Hủy giao bài ${item.title}`} disabled={item.attemptCount > 0 || item.status === 'cancelled'} onClick={() => actions.confirm('Hủy giao bài', 'Chỉ hủy giao bài chưa có lượt làm.', `/admin/assignments/${item.id}`)}>Hủy giao bài</button></div>])} />{pagination(data)}</section>}</LoadState>{actions.editor && <Modal variant="assignment" title={actions.editor.id ? 'Chỉnh sửa giao bài' : 'Giao đề cho lớp hoặc học sinh'} onClose={actions.close}><AssignmentForm initial={actions.editor} onSaved={actions.saved} /></Modal>}{actions.confirmationUi}</div>;
}

function SubjectDetail({ recordId }) {
  const resource = useLoad(`/admin/subjects/${recordId}`);
  const router = useRouter();
  return <div className="stack"><Heading title="Chi tiết và chỉnh sửa môn học" action={<Link className="btn secondary" href="/admin/subjects">Danh sách môn học</Link>} /><LoadState resource={resource}>{data => <section className="panel panel-body"><CatalogForm kind="subjects" initial={data} onSaved={() => router.push('/admin/subjects')} /></section>}</LoadState></div>;
}

function QuestionDetail({ recordId }) {
  const resource = useLoad(`/admin/questions/${recordId}`);
  const router = useRouter();
  return <div className="stack"><Heading title="Chi tiết và chỉnh sửa câu hỏi" subtitle="Câu hỏi thuộc đề đã xuất bản không được sửa để giữ lịch sử." action={<Link className="btn secondary" href="/admin/questions">Ngân hàng câu hỏi</Link>} /><LoadState resource={resource}>{data => <section className="panel panel-body"><QuestionForm key={data.id} initial={data} onSaved={() => router.push('/admin/questions')} /></section>}</LoadState></div>;
}

function AssignmentDetail({ recordId }) {
  const resource = useLoad(`/admin/assignments/${recordId}`);
  const classes = useCatalog('/admin/classes');
  const students = useCatalog('/admin/students');
  const router = useRouter();
  const classNames = new Map(classes.data?.items.map(item => [item.id, item.name]) || []);
  const studentNames = new Map(students.data?.items.map(item => [item.id, `${item.studentCode} — ${item.fullName}`]) || []);
  return <div className="stack"><LoadState resource={resource}>{data => {
    const readonly = data.attemptCount > 0 || data.status === 'cancelled';
    const targets = data.targetType === 'class' ? data.classIds.map(recordId => classNames.get(recordId) || 'Đang tải tên lớp…') : data.studentIds.map(recordId => studentNames.get(recordId) || 'Đang tải tên học sinh…');
    return <><Heading title={readonly ? 'Chi tiết giao bài' : 'Chi tiết và chỉnh sửa giao bài'} subtitle={data.title} action={<Link className="btn secondary" href="/admin/assignments">Danh sách giao bài</Link>} /><section className="panel panel-body stack"><dl className="detail-grid"><div><dt>Đề kiểm tra</dt><dd><Link className="link-button" href={`/admin/quizzes/${data.quizId}`}>{data.title}</Link></dd></div><div><dt>Trạng thái</dt><dd><Badge state={data.status} /></dd></div><div><dt>Đối tượng</dt><dd>{targets.join(', ')}</dd></div><div><dt>Số lượt đã làm</dt><dd>{data.attemptCount}</dd></div><div><dt>Giờ mở</dt><dd>{date(data.openAt)}</dd></div><div><dt>Hạn nộp</dt><dd>{date(data.dueAt)}</dd></div><div><dt>Lượt tối đa</dt><dd>{data.maxAttempts}</dd></div><div><dt>Xem đáp án sau nộp</dt><dd>{data.showAnswersAfterSubmit ? 'Có' : 'Không'}</dd></div></dl>{readonly ? <p className="question-help">Giao bài đã có lượt làm hoặc đã hủy: chỉ xem chi tiết, không chỉnh sửa hoặc hủy lại.</p> : <AssignmentForm key={data.id} initial={data} onSaved={() => router.push('/admin/assignments')} />}</section></>;
  }}</LoadState></div>;
}

function Results() {
  const [filters, setFilters] = useState({ q: '', classId: '', subjectId: '', quizId: '', studentId: '', result: '' });
  const classes = useCatalog('/admin/classes');
  const subjects = useCatalog('/admin/subjects');
  const quizzes = useCatalog('/admin/quizzes');
  const students = useCatalog('/admin/students');
  const { resource, pagination, setPage, sorting } = useList(`/admin/results?${new URLSearchParams(filters)}`);
  const options = [['classId', 'Lớp', classes.data?.items, 'name'], ['subjectId', 'Môn', subjects.data?.items, 'name'], ['quizId', 'Đề', quizzes.data?.items, 'title'], ['studentId', 'Học sinh', students.data?.items, 'fullName']];
  const set = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); };
  return <div className="stack"><Heading title="Kết quả" subtitle="Xem kết quả theo đề, lớp, môn học và học sinh" /><div className="toolbar"><input className="input" placeholder="Tên bài, học sinh hoặc mã…" aria-label="Tìm kết quả" value={filters.q} onChange={event => set('q', event.target.value)} />{options.map(([key, label, items, field]) => <Select className="select compact" aria-label={`Lọc ${label}`} key={key} value={filters[key]} onChange={event => set(key, event.target.value)}><option value="">Tất cả {label.toLowerCase()}</option>{items?.map(item => <option key={item.id} value={item.id}>{item[field]}</option>)}</Select>)}<FilterControl label="Lọc kết quả" placeholder="Tất cả kết quả" value={filters.result} onChange={value => set('result', value)} options={[['pass', 'Từ 5 điểm'], ['fail', 'Dưới 5 điểm']]} /><button type="button" className="btn secondary filter-reset" disabled={!Object.values(filters).some(Boolean)} onClick={() => { setFilters({ q: '', classId: '', subjectId: '', quizId: '', studentId: '', result: '' }); setPage(1); }}>Xóa bộ lọc</button></div><LoadState resource={resource}>{data => <section className="panel"><DataTable sorting={sorting} sortFields={['fullName', 'className', 'title', 'subjectName', 'attemptNumber', 'score', 'submittedAt', 'timeUsedSeconds']} headers={['Học sinh', 'Lớp', 'Đề', 'Môn', 'Lượt', 'Điểm', 'Nộp lúc', 'Thời gian']} rows={data.items.map(item => [`${item.studentCode} — ${item.fullName}`, item.className || 'Chưa có lớp', item.title, item.subjectName, item.attemptNumber, `${score(item.score)}/10`, date(item.submittedAt), time(item.timeUsedSeconds)])} />{pagination(data)}</section>}</LoadState></div>;
}

export default function AdminPage({ segments }) {
  const [section, detail] = segments;
  if (section === 'dashboard') return <Dashboard />;
  if (section === 'profile') return <Profile />;
  if (section === 'students') return detail === 'new' ? <NewStudent /> : detail ? <StudentDetail recordId={detail} /> : <Students />;
  if (section === 'classes') return detail ? <ClassDetail recordId={detail} /> : <Catalog key="classes" kind="classes" />;
  if (section === 'subjects') return detail ? <SubjectDetail recordId={detail} /> : <Catalog key="subjects" kind="subjects" />;
  if (section === 'questions') return detail ? <QuestionDetail recordId={detail} /> : <Questions />;
  if (section === 'quizzes') return detail === 'new' ? <NewQuiz /> : ['drafts', 'published', 'archived'].includes(detail) || !detail ? <Quizzes key={detail || 'all'} status={{ drafts: 'draft', published: 'published', archived: 'archived' }[detail] || ''} /> : <QuizDetail recordId={detail} />;
  if (section === 'assignments') return detail ? <AssignmentDetail recordId={detail} /> : <Assignments />;
  if (section === 'results') return <Results />;
  return <Empty title="Không tìm thấy màn hình" />;
}
