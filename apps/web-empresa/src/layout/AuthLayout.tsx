import type { ReactNode } from 'react';

import logo from '../assets/logo.png';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <img className="auth-logo" src={logo} alt="FireStock" />
        <div className="card">{children}</div>
      </div>
    </div>
  );
}
