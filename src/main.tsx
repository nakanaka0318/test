import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// ゲームループと WebGL コンテキストを二重生成しないため StrictMode は使わない
createRoot(document.getElementById('root')!).render(<App />);
