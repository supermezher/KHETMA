import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyAppTheme, loadAppTheme } from './utils/appTheme';

applyAppTheme(loadAppTheme());

createRoot(document.getElementById('root')!).render(<App />);
