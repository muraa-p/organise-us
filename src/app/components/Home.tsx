import { Link } from 'react-router';
import { Button } from './ui/button';
import { Users, QrCode, Shuffle, Sparkles, ArrowRight } from 'lucide-react';

export function Home() {
  return (
    <div className="min-h-screen bg-[#f8f6f2]">
      <nav className="border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-slate-900" />
            <span className="text-xl font-semibold">Group Organizer</span>
          </div>
          <div className="flex gap-3">
            <Link to="/dashboard">
              <Button>Start</Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost">Login</Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(15,23,42,0.08),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(14,116,144,0.12),transparent_50%)]" />
        <div className="container relative mx-auto px-4 py-20">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm text-slate-700 shadow">
                <Sparkles className="h-4 w-4" />
                Auto-assign participants into groups in seconds.
              </div>
              <h1 className="mt-6 text-5xl md:text-6xl font-semibold tracking-tight text-slate-900">
                Build balanced groups with one QR scan.
              </h1>
              <p className="mt-6 text-lg text-slate-600">
                Set how many groups you want, choose the group size, then share the QR.
                Participants scan, enter their name, and instantly see their group and teammates.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/dashboard">
                  <Button size="lg" className="text-base">
                    Create an Event
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button size="lg" variant="outline" className="text-base">
                    Compare Plans
                  </Button>
                </Link>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-slate-300/60 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">Live Preview</p>
                    <h3 className="text-xl font-semibold text-slate-900 mt-2">Strategy Workshop</h3>
                    <p className="text-sm text-slate-500">6 groups · 4 seats each</p>
                  </div>
                  <div className="h-16 w-16 rounded-2xl bg-slate-900/10 flex items-center justify-center text-xs text-slate-500">
                    QR
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {['Group 1', 'Group 2', 'Group 3', 'Group 4'].map((label) => (
                    <div key={label} className="rounded-2xl border border-slate-200 p-3 text-sm">
                      <p className="font-semibold text-slate-800">{label}</p>
                      <ul className="mt-2 space-y-1 text-slate-500 text-xs">
                        <li>Amira</li>
                        <li>Malik</li>
                        <li>Jonas</li>
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-slate-900 p-3 text-xs text-white flex items-center justify-between">
                  <span>Participants see groupmates instantly</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/60">
              <div className="flex items-center justify-between">
                <Users className="h-8 w-8 text-slate-900" />
                <span className="text-xs uppercase tracking-widest text-slate-400">Step 1</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold">Set your groups</h3>
              <p className="mt-2 text-slate-600">
                Pick the number of groups and the participants per group. We calculate the total seats.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/60">
              <div className="flex items-center justify-between">
                <QrCode className="h-8 w-8 text-slate-900" />
                <span className="text-xs uppercase tracking-widest text-slate-400">Step 2</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold">Share the QR</h3>
              <p className="mt-2 text-slate-600">
                Display the QR on a screen or print it. Participants can join with any phone.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/60">
              <div className="flex items-center justify-between">
                <Shuffle className="h-8 w-8 text-slate-900" />
                <span className="text-xs uppercase tracking-widest text-slate-400">Step 3</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold">Auto-assign</h3>
              <p className="mt-2 text-slate-600">
                Names are assigned to groups randomly and revealed with their groupmates.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl font-semibold text-slate-900">Built for workshops, classes, and events.</h2>
            <p className="mt-4 text-slate-600">
              Keep the experience frictionless for participants. You create the event once,
              then everyone sees their group instantly as they join.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">Randomized grouping</div>
              <div className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">Live roster updates</div>
              <div className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">Mobile-friendly join</div>
            </div>
          </div>
          <div className="rounded-3xl bg-[#f8f6f2] p-6 shadow-inner">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-xs uppercase tracking-widest text-slate-400">Pro highlights</p>
              <h3 className="mt-2 text-xl font-semibold">Get more control</h3>
              <ul className="mt-4 space-y-3 text-slate-600 text-sm">
                <li>Custom participant questions</li>
                <li>CSV export for rosters</li>
                <li>Unlimited events and branded share pages</li>
              </ul>
              <Link to="/pricing" className="mt-6 inline-flex items-center text-sm font-semibold text-slate-900">
                Explore Pro
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/5 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          © 2026 Group Organizer. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
