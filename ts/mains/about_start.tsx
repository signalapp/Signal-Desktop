import { createRoot } from 'react-dom/client';
import { AboutView } from '../components/AboutView';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<AboutView />);
