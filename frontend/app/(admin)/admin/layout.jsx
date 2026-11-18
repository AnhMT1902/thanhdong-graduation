import { requireRole } from '../../../lib/server';
import Shell from '../../../components/Shell';
export default async function AdminLayout({ children }) { const user = await requireRole('admin'); return <Shell user={user}>{children}</Shell>; }
