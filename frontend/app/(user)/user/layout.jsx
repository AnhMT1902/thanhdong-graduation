import { requireRole } from '../../../lib/server';
import Shell from '../../../components/Shell';
export default async function UserLayout({ children }) { const user = await requireRole('student'); return <Shell user={user}>{children}</Shell>; }
