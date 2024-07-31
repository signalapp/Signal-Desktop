import { createRoot } from 'react-dom/client';
import { DebugLogView } from '../components/DebugLogView';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<DebugLogView />);
