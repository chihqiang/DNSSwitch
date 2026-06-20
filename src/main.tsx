// ============================================================
// 应用入口文件
// 挂载 React 应用到 DOM，初始化 i18n 和全局样式
// ============================================================

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './i18n';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
