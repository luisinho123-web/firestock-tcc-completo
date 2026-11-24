import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import { UnsavedChangesProvider } from './components/UnsavedChanges';
import './styles/global.css';

// Roteador de dados com uma rota "curinga": as rotas de verdade continuam em <App /> (necessário para o aviso de sair sem salvar).
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <AuthProvider idleMinutes={30}>
        <ToastProvider>
          <UnsavedChangesProvider>
            <App />
          </UnsavedChangesProvider>
        </ToastProvider>
      </AuthProvider>
    ),
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
