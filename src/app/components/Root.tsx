import { Outlet } from 'react-router';

export function Root() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}
