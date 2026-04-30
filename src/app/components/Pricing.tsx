import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { auth } from '../lib/auth';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Users, Crown, Download, Check, ArrowLeft, Sparkles } from 'lucide-react';

export function Pricing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<'free' | 'pro' | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkout = params.get('checkout');
    if (!checkout) {
      return;
    }

    if (checkout === 'success') {
      toast.success('Payment received. Your Pro access will activate shortly.');
      checkAuth();
    }

    if (checkout === 'cancel') {
      toast.info('Checkout canceled.');
    }

    navigate('/pricing', { replace: true });
  }, [location.search, navigate]);

  const checkAuth = async () => {
    try {
      const session = await auth.getSession();
      if (session) {
        setIsLoggedIn(true);
        const profile = await api.getProfile(session.access_token);
        setCurrentPlan(profile.subscription);
      }
    } catch {
      // User not logged in
    }
  };

  const handleUpgrade = async () => {
    if (!isLoggedIn) {
      toast.info('Please sign in to upgrade to Pro');
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const session = await auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      const checkout = await api.createCheckoutSession(session.access_token);
      if (!checkout?.url) {
        throw new Error('Checkout session not available');
      }
      window.location.href = checkout.url;
    } catch (error: any) {
      console.error('Error upgrading:', error);
      toast.error(error.message || 'Failed to upgrade');
    } finally {
      setLoading(false);
    }
  };

  const handleManage = async () => {
    setLoading(true);
    try {
      const session = await auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      const portal = await api.createPortalSession(session.access_token);
      if (!portal?.url) {
        throw new Error('Billing portal unavailable');
      }
      window.location.href = portal.url;
    } catch (error: any) {
      console.error('Error opening billing portal:', error);
      toast.error(error.message || 'Failed to open billing portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2]">
      <nav className="border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to={isLoggedIn ? "/dashboard" : "/"} className="flex items-center gap-2">
            <Users className="h-6 w-6 text-slate-900" />
            <span className="text-xl font-semibold">Group Organizer</span>
          </Link>
          <div className="flex gap-3">
            {isLoggedIn ? (
              <Link to="/dashboard">
                <Button variant="ghost">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost">Login</Button>
                </Link>
                <Link to="/signup">
                  <Button>Sign Up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="py-12 text-center">
        <div className="container mx-auto px-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-700 shadow">
            <Sparkles className="h-4 w-4" />
            Plans for small teams and large events
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl font-semibold">Choose your plan</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mt-4">
            Start free, then upgrade when you need unlimited events, custom questions, and exports.
          </p>
        </div>
      </section>

      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card className={`relative border-none shadow-lg shadow-slate-200/60 ${currentPlan === 'free' ? 'ring-2 ring-slate-900' : ''}`}>
              {currentPlan === 'free' && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge>Current Plan</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">Free</CardTitle>
                <CardDescription>Great for small events</CardDescription>
                <div className="text-4xl font-semibold mt-4">
                  $0<span className="text-lg text-gray-500">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-emerald-500 mt-0.5" />
                    <span>Up to 3 events</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-emerald-500 mt-0.5" />
                    <span>QR code sharing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-emerald-500 mt-0.5" />
                    <span>Random group assignments</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-emerald-500 mt-0.5" />
                    <span>Name collection only</span>
                  </li>
                </ul>
                {!isLoggedIn ? (
                  <Link to="/dashboard">
                    <Button className="w-full" variant="outline">Start Free</Button>
                  </Link>
                ) : currentPlan === 'free' ? (
                  <Button className="w-full" variant="outline" disabled>Current Plan</Button>
                ) : null}
              </CardContent>
            </Card>

            <Card className="relative border-none shadow-lg shadow-slate-200/60 bg-white">
              {currentPlan === 'pro' ? (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge>Current Plan</Badge>
                </div>
              ) : (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-slate-900 text-white">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="bg-gradient-to-br from-slate-900 to-slate-700 text-white rounded-t-lg">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Crown className="h-6 w-6 text-amber-300" />
                  Pro
                </CardTitle>
                <CardDescription className="text-slate-200">For recurring workshops</CardDescription>
                <div className="text-4xl font-semibold mt-4">
                  $19<span className="text-lg text-slate-200">/month</span>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm font-semibold text-slate-700 mb-3">Everything in Free, plus:</p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2">
                    <Crown className="h-5 w-5 text-slate-900 mt-0.5" />
                    <span><strong>Unlimited events</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-slate-900 mt-0.5" />
                    <span>Custom participant questions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Download className="h-5 w-5 text-slate-900 mt-0.5" />
                    <span>CSV export for rosters</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-slate-900 mt-0.5" />
                    <span>Branding removal</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-slate-900 mt-0.5" />
                    <span>Priority support</span>
                  </li>
                </ul>
                {currentPlan === 'pro' ? (
                  <Button className="w-full" variant="outline" onClick={handleManage} disabled={loading}>
                    {loading ? 'Opening...' : 'Manage Subscription'}
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-slate-900 hover:bg-slate-800"
                    onClick={handleUpgrade}
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : isLoggedIn ? 'Upgrade to Pro' : 'Sign In for Pro'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="max-w-5xl mx-auto mt-10 grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Free users keep data locally in the browser. Sign in to sync across devices.
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Pro features apply immediately after upgrade. You can downgrade anytime.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
