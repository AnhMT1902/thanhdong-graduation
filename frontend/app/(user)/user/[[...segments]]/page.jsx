import { redirect } from 'next/navigation';
import UserPage from '../../../../components/UserPage';
export default async function Page({ params }) { const { segments = ['dashboard'] } = await params; if (segments[0] === 'exams') redirect('/user/assignments'); return <UserPage segments={segments} />; }
