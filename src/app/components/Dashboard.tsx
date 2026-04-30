import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { auth } from '../lib/auth';
import { api } from '../lib/api';
import { localStorage as localDB } from '../lib/localStorage';
import { toast } from 'sonner';
import { Users, Plus, LogOut, Crown, Trash2, QrCode, RefreshCw, LogIn, Layers } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

interface Group {
  id: string;
  name: string;
  slug?: string;
  description: string;
  participantCount: number;
  createdAt: string;
  groupCount: number;
  groupSize: number;
  maxParticipants: number;
}

interface Profile {
  name: string;
  email: string;
  subscription: 'free' | 'pro';
}

type UserMode = 'anonymous' | 'authenticated';

export function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [userMode, setUserMode] = useState<UserMode>('anonymous');

  useEffect(() => {
    loadData();
  }, [location.pathname]);

  const prunePublicGroups = async (localGroups: Group[]) => {
    const cleaned = await Promise.all(
      localGroups.map(async (group: any) => {
        if (group.origin !== 'public') {
          return group;
        }
        try {
          await api.getPublicGroup(group.id || group.slug);
          return group;
        } catch (error: any) {
          if ((error?.message || '').includes('Group not found')) {
            localDB.deleteGroup(group.id);
            return null;
          }
          return group;
        }
      })
    );

    return cleaned.filter(Boolean) as Group[];
  };

  const loadData = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    }
    try {
      const session = await auth.getSession();

      if (session) {
        setUserMode('authenticated');
        setToken(session.access_token);

        const [profileData, groupsData] = await Promise.all([
          api.getProfile(session.access_token),
          api.getGroups(session.access_token)
        ]);

        setProfile(profileData);
        setGroups(groupsData.groups);
      } else {
        setUserMode('anonymous');
        const localGroups = localDB.getGroups();
        const cleanedGroups = await prunePublicGroups(localGroups as unknown as Group[]);
        setGroups(cleanedGroups);
        setProfile({
          name: 'Anonymous Organizer',
          email: '',
          subscription: 'free'
        });
      }
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
      if ((error?.message || '').includes('Invalid JWT')) {
        try {
          const refreshed = await auth.refreshSession();
          if (refreshed) {
            setUserMode('authenticated');
            setToken(refreshed.access_token);
            const [profileData, groupsData] = await Promise.all([
              api.getProfile(refreshed.access_token),
              api.getGroups(refreshed.access_token)
            ]);
            setProfile(profileData);
            setGroups(groupsData.groups);
            setLoading(false);
            setRefreshing(false);
            return;
          }
        } catch (refreshError) {
          console.warn('Failed to refresh session:', refreshError);
        }

        try {
          await auth.signOut();
        } catch {
          // Ignore sign out failures.
        }
        toast.error('Session expired. Please sign in again.');
        navigate('/login');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setUserMode('anonymous');
      const localGroups = localDB.getGroups();
      const cleanedGroups = await prunePublicGroups(localGroups as unknown as Group[]);
      setGroups(cleanedGroups);
      setProfile({
        name: 'Anonymous Organizer',
        email: '',
        subscription: 'free'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const totalParticipants = useMemo(
    () => groups.reduce((sum, group) => sum + (group.participantCount || 0), 0),
    [groups]
  );

  const handleRefresh = () => {
    loadData(true);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      const targetGroup = groups.find(group => group.id === groupId);
      if (userMode === 'authenticated' && token) {
        await api.deleteGroup(groupId, token);
      } else if (targetGroup && (targetGroup as any).origin === 'public' && (targetGroup as any).organizerKey) {
        try {
          await api.deletePublicGroup(groupId, (targetGroup as any).organizerKey);
        } catch (error: any) {
          if ((error?.message || '').includes('Group not found')) {
            localDB.deleteGroup(groupId);
            setGroups(groups.filter(group => group.id !== groupId));
            toast.info('Removed local copy. This event no longer exists on the server.');
            return;
          }
          throw error;
        }
      } else {
        localDB.deleteGroup(groupId);
      }
      setGroups(groups.filter(group => group.id !== groupId));
      toast.success('Event deleted');
    } catch (error: any) {
      console.error('Error deleting group:', error);
      toast.error(error.message || 'Failed to delete event');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f6f2]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const canCreateGroup = profile?.subscription === 'pro' || (groups.length < 3);

  return (
    <div className="min-h-screen bg-[#f8f6f2]">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2 text-xl font-semibold">
              <Users className="h-6 w-6 text-slate-900" />
              Group Organizer
            </Link>
            <div className="flex items-center gap-4">
              {userMode === 'authenticated' ? (
                <>
                  <div className="text-right">
                    <p className="font-medium">{profile?.name}</p>
                    <div className="flex items-center gap-2 justify-end">
                      <Badge variant={profile?.subscription === 'pro' ? 'default' : 'secondary'}>
                        {profile?.subscription === 'pro' ? (
                          <><Crown className="h-3 w-3 mr-1" /> Pro</>
                        ) : (
                          'Free'
                        )}
                      </Badge>
                      {profile?.subscription === 'free' && (
                        <Link to="/pricing">
                          <Button variant="link" size="sm" className="h-auto p-0 text-slate-700">
                            Upgrade
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Free Mode</p>
                    <Badge variant="secondary">
                      {groups.length}/3 events
                    </Badge>
                  </div>
                  <Link to="/login">
                    <Button>
                      <LogIn className="h-4 w-4 mr-2" />
                      Sign In for Pro
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {userMode === 'anonymous' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Guest events are shareable, but management access stays on this browser. Sign in to sync across devices.
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-none shadow-lg shadow-slate-200/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Layers className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{groups.length}</div>
              <p className="text-xs text-gray-500">
                {profile?.subscription === 'free' ? `${groups.length}/3 events used` : 'Unlimited'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg shadow-slate-200/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Participants</CardTitle>
              <Users className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{totalParticipants}</div>
              <p className="text-xs text-gray-500">Across all events</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg shadow-slate-200/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Plan</CardTitle>
              <Crown className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold capitalize">{profile?.subscription}</div>
              {profile?.subscription === 'free' && (
                <Link to="/pricing">
                  <Button variant="link" size="sm" className="h-auto p-0">
                    Upgrade to Pro
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1">
            {canCreateGroup ? (
              <Link to="/create-group">
                <Button size="lg">
                  <Plus className="h-5 w-5 mr-2" />
                  Create New Event
                </Button>
              </Link>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800 mb-2">
                  You have reached the free plan limit of 3 events.
                </p>
                <Link to="/pricing">
                  <Button>
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade for Unlimited Events
                  </Button>
                </Link>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="lg"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Your Events</h2>

          {groups.length === 0 ? (
            <Card className="border-none shadow-lg shadow-slate-200/60">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No events yet. Create your first group flow!</p>
                <Link to="/create-group">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Event
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {groups.map((group) => (
                <Card key={group.id} className="border-none shadow-lg shadow-slate-200/60">
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between">
                      <span className="truncate">{group.name}</span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-2">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete event?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{group.name}" and all participants.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteGroup(group.id)} className="bg-red-600 hover:bg-red-700">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardTitle>
                    <CardDescription className="line-clamp-2">{group.description || 'No description'}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{group.participantCount || 0} joined</span>
                      <span>{group.groupCount || 2} groups · {group.groupSize || 4} each</span>
                    </div>
                    <Link to={`/groups/${group.slug || group.id}`}>
                      <Button className="w-full">
                        <QrCode className="h-4 w-4 mr-2" />
                        Open QR & Roster
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
