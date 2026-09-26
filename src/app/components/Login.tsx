import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { auth, isDemoMode } from '../lib/auth';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../lib/demo';
import { toast } from 'sonner';
import { Users, Sparkles } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // /login?demo=1 jumps straight into the demo — handy for sharing a link.
  useEffect(() => {
    if (!isDemoMode) return;
    if (new URLSearchParams(window.location.search).get('demo') !== '1') return;
    (async () => {
      try {
        await auth.signIn(DEMO_EMAIL, DEMO_PASSWORD);
        navigate('/dashboard');
      } catch { /* stay on the login page */ }
    })();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {    e.preventDefault();
    setLoading(true);

    try {
      await auth.signIn(email, password);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f6f2] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Users className="h-8 w-8 text-slate-900" />
            Group Organizer
          </Link>
        </div>

        <Card className="border-none shadow-xl shadow-slate-200/60">
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              {isDemoMode ? (
                <>
                  <p className="text-slate-500 mb-3">
                    No account needed — this deployment runs in demo mode with
                    sample data and no database.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={async () => {
                      setEmail(DEMO_EMAIL);
                      setPassword(DEMO_PASSWORD);
                      setLoading(true);
                      try {
                        await auth.signIn(DEMO_EMAIL, DEMO_PASSWORD);
                        toast.success('Welcome to the demo!');
                        navigate('/dashboard');
                      } catch (error: any) {
                        toast.error(error.message || 'Could not start the demo');
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Explore the demo
                  </Button>
                  <p className="mt-4 text-sm">
                    <Link to="/" className="text-slate-900 hover:underline font-medium">
                      Browse public groups instead
                    </Link>
                  </p>
                </>
              ) : (
                <>
                  <span className="text-slate-600">Don't have an account? </span>
                  <Link to="/signup" className="text-slate-900 hover:underline font-medium">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
