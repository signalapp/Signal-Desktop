import { createRoot } from 'react-dom/client';
import { SessionPasswordPrompt } from '../components/SessionPasswordPrompt';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<SessionPasswordPrompt />);
