import { Link } from 'react-router';
import { Button } from './ui/button';
import { Home } from 'lucide-react';

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f6f2] p-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-slate-900 mb-4">404</h1>
        <h2 className="text-3xl font-semibold text-slate-900 mb-4">Page Not Found</h2>
        <p className="text-slate-600 mb-8 max-w-md">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <Button size="lg">
            <Home className="h-5 w-5 mr-2" />
            Go Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
