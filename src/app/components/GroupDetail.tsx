import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { auth } from '../lib/auth';
import { api } from '../lib/api';
import { localStorage as localDB } from '../lib/localStorage';
import { toast } from 'sonner';
import { ArrowLeft, Download, QrCode as QrCodeIcon, Share2, Users, Layers } from 'lucide-react';
import QRCode from 'qrcode';

interface Field {
  key: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea';
  required: boolean;
}

interface Group {
  id: string;
  name: string;
  slug?: string;
  description: string;
  fields: Field[];
  nameField: string;
  groupCount: number;
  groupSize: number;
  maxParticipants: number;
  createdAt: string;
  participantCount: number;
  origin?: 'local' | 'public';
  organizerKey?: string;
}

interface Participant {
  id: string;
  data: Record<string, any>;
  assignedGroup: number;
  joinedAt: string;
}

interface Profile {
  subscription: 'free' | 'pro';
}

export function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [userId, setUserId] = useState('');
  const [userMode, setUserMode] = useState<'anonymous' | 'authenticated'>('anonymous');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [groupId]);

  const totalSeats = useMemo(() => {
    if (!group) {
      return 0;
    }
    return group.maxParticipants || (group.groupCount * group.groupSize);
  }, [group]);

  const remainingSeats = useMemo(() => {
    if (!group) {
      return 0;
    }
    return Math.max(0, totalSeats - (participants.length || 0));
  }, [group, participants.length, totalSeats]);

  const groupedParticipants = useMemo(() => {
    if (!group) {
      return [];
    }
    return Array.from({ length: group.groupCount }, (_, index) => {
      const groupNumber = index + 1;
      const members = participants.filter((participant) => participant.assignedGroup === groupNumber);
      return { groupNumber, members };
    });
  }, [group, participants]);

  const displayName = (participant: Participant) => {
    const nameKey = group?.nameField || 'name';
    return participant.data?.[nameKey] || participant.data?.name || 'Participant';
  };

  const normalizeFields = (rawFields: any[]): Field[] => {
    return (rawFields || []).map((field, index) => ({
      key: field.key || field.name || `field_${index + 1}`,
      label: field.label || field.name || `Field ${index + 1}`,
      type: field.type || 'text',
      required: !!field.required
    }));
  };

  const normalizeParticipants = (rawParticipants: any[], totalGroups: number) => {
    return (rawParticipants || []).map((participant, index) => ({
      ...participant,
      assignedGroup: participant.assignedGroup || ((index % totalGroups) + 1)
    }));
  };

  const refreshParticipants = async () => {
    if (!group) {
      return;
    }

    try {
      let participantsData: any[] = [];
      if (userMode === 'authenticated') {
        const session = await auth.getSession();
        if (!session) {
          return;
        }
        const response = await api.getParticipants(group.id, session.access_token);
        participantsData = response.participants || [];
      } else if (group.origin === 'public') {
        if (!group.organizerKey) {
          return;
        }
        const response = await api.getPublicParticipantsOwner(group.id, group.organizerKey);
        participantsData = response.participants || [];
      } else {
        participantsData = localDB.getParticipants(group.id) as any[];
      }

      const normalized = normalizeParticipants(participantsData, group.groupCount || 2);
      setParticipants(normalized);
      setGroup(prev => prev ? { ...prev, participantCount: normalized.length } : prev);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to refresh participants:', error);
    }
  };

  const loadAnonymousGroup = async () => {
    setUserMode('anonymous');
    let currentGroup = localDB.getGroup(groupId!);
    if (!currentGroup) {
      currentGroup = localDB.getGroups().find(g => g.slug === groupId) || null;
    }
    if (!currentGroup) {
      toast.error('Event not found');
      navigate('/dashboard');
      return;
    }

    const isPublic = currentGroup.origin === 'public';
    setUserId(isPublic ? 'public' : 'local');

    let resolvedGroup = currentGroup as any;
    if (isPublic) {
      try {
        const publicGroup = await api.getPublicGroup(groupId!);
        resolvedGroup = {
          ...publicGroup,
          origin: 'public',
          organizerKey: currentGroup.organizerKey
        };
      } catch (error: any) {
        if ((error?.message || '').includes('Group not found')) {
          localDB.deleteGroup(groupId!);
          toast.error('This event no longer exists. It was removed from your dashboard.');
          navigate('/dashboard');
          return;
        }
        throw error;
      }
    }

    const localParticipants = isPublic
      ? (await api.getPublicParticipantsOwner(groupId!, currentGroup.organizerKey || '')).participants
      : localDB.getParticipants(groupId!);

    const normalizedFields = normalizeFields((resolvedGroup as any).fields);
    const resolvedGroupCount = (resolvedGroup as any).groupCount || 2;
    const resolvedGroupSize = (resolvedGroup as any).groupSize || 4;

    setGroup({
      ...(resolvedGroup as any),
      fields: normalizedFields,
      nameField: (resolvedGroup as any).nameField || normalizedFields[0]?.key || 'name',
      groupCount: resolvedGroupCount,
      groupSize: resolvedGroupSize,
      maxParticipants: (resolvedGroup as any).maxParticipants || (resolvedGroupCount * resolvedGroupSize)
    });
    setParticipants(normalizeParticipants(localParticipants as unknown as Participant[], resolvedGroupCount));
    setProfile({ subscription: 'free' });

    const shareId = isPublic ? ((resolvedGroup as any).slug || groupId) : groupId;
    const joinUrl = `${window.location.origin}/join/${isPublic ? 'public' : 'local'}/${shareId}`;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#111827',
        light: '#ffffff'
      }
    });
    setQrCodeUrl(qrDataUrl);
  };

  const loadData = async () => {
    try {
      const session = await auth.getSession();

      if (session) {
        setUserMode('authenticated');
        const user = await auth.getUser();
        setUserId(user.id);

        const [profileData, groupsData] = await Promise.all([
          api.getProfile(session.access_token),
          api.getGroups(session.access_token)
        ]);

        const currentGroup = groupsData.groups.find(
          (g: Group) => g.id === groupId || g.slug === groupId
        );
        if (!currentGroup) {
          await loadAnonymousGroup();
          return;
        }

        const normalizedFields = normalizeFields((currentGroup as any).fields);
        const resolvedGroupCount = currentGroup.groupCount || 2;
        const resolvedGroupSize = currentGroup.groupSize || 4;
        const resolvedGroupId = currentGroup.id;

        let participantsData = { participants: [] as Participant[] };
        try {
          participantsData = await api.getParticipants(resolvedGroupId, session.access_token);
        } catch (error: any) {
          console.warn('Failed to load participants, continuing:', error);
        }

        setProfile(profileData);
        setGroup({
          ...currentGroup,
          id: resolvedGroupId,
          fields: normalizedFields,
          nameField: (currentGroup as any).nameField || normalizedFields[0]?.key || 'name',
          groupCount: resolvedGroupCount,
          groupSize: resolvedGroupSize,
          maxParticipants: currentGroup.maxParticipants || (resolvedGroupCount * resolvedGroupSize)
        });
        setParticipants(normalizeParticipants(participantsData.participants, resolvedGroupCount));

        const shareId = (currentGroup as any).slug || resolvedGroupId;
        const joinUrl = `${window.location.origin}/join/${user.id}/${shareId}`;
        const qrDataUrl = await QRCode.toDataURL(joinUrl, {
          width: 400,
          margin: 2,
          color: {
            dark: '#111827',
            light: '#ffffff'
          }
        });
        setQrCodeUrl(qrDataUrl);
      } else {
        await loadAnonymousGroup();
      }
    } catch (error: any) {
      console.error('Error loading event:', error);
      toast.error('Failed to load event');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!group) {
      return;
    }
    refreshParticipants();
    const interval = window.setInterval(() => {
      refreshParticipants();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [group?.id, userMode]);

  const downloadQRCode = () => {
    if (!group) {
      return;
    }
    const link = document.createElement('a');
    link.download = `${group.name}-qrcode.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const copyJoinLink = () => {
    const shareId = userId === 'local' ? groupId : (group?.slug || groupId);
    const joinUrl = `${window.location.origin}/join/${userId}/${shareId}`;
    navigator.clipboard.writeText(joinUrl);
    toast.success('Join link copied to clipboard!');
  };

  const exportToCSV = () => {
    if (!group || participants.length === 0) {
      toast.error('No participants to export');
      return;
    }

    const fieldNames = group.fields.map((field) => field.label);
    const headers = ['Group', ...fieldNames, 'Joined At'];

    const csvContent = [
      headers.join(','),
      ...participants.map(participant => {
        const row = [
          `Group ${participant.assignedGroup}`,
          ...group.fields.map((field) => {
            const value = participant.data[field.key] || '';
            return `"${value.toString().replace(/"/g, '""')}"`;
          }),
          `"${new Date(participant.joinedAt).toLocaleString()}"`
        ];
        return row.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${group.name}-participants.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success('Roster exported');
  };

  if (loading || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f6f2]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading event...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f2]">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
          {profile?.subscription === 'pro' ? (
            <Badge className="bg-slate-900 text-white">Pro</Badge>
          ) : (
            <Badge variant="secondary">Free</Badge>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{group.name}</h1>
            <p className="text-slate-600 mt-2 max-w-2xl">{group.description}</p>
            <div className="flex flex-wrap gap-3 mt-4">
              <Badge variant="secondary" className="flex items-center gap-2">
                <Users className="h-3 w-3" />
                {participants.length} joined
              </Badge>
              <Badge variant="outline" className="flex items-center gap-2">
                <Layers className="h-3 w-3" />
                {group.groupCount} groups
              </Badge>
              <Badge variant="outline">
                {group.groupSize} per group
              </Badge>
              <Badge variant="outline">
                {remainingSeats} seats left
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            {participants.length > 0 && profile?.subscription === 'pro' && (
              <Button onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 border-none shadow-xl shadow-slate-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCodeIcon className="h-5 w-5" />
                QR Code
              </CardTitle>
              <CardDescription>Scan to join and get assigned instantly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {userMode === 'anonymous' && group.origin !== 'public' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Local events can’t be opened on other devices. Create a shareable guest event or sign in.
                </div>
              )}
              {qrCodeUrl && (
                <div className="bg-white p-4 rounded-lg border">
                  <img src={qrCodeUrl} alt="QR Code" className="w-full h-auto" />
                </div>
              )}
              <div className="space-y-2">
                <Button className="w-full" onClick={downloadQRCode} disabled={userMode === 'anonymous' && group.origin !== 'public'}>
                  <Download className="h-4 w-4 mr-2" />
                  Download QR
                </Button>
                <Button className="w-full" variant="outline" onClick={copyJoinLink} disabled={userMode === 'anonymous' && group.origin !== 'public'}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Copy Join Link
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-none shadow-xl shadow-slate-200/60">
            <CardHeader>
              <CardTitle>Live Group Board</CardTitle>
              <CardDescription>
                Participants see their groupmates after joining. {lastUpdated ? `Last updated ${lastUpdated}.` : 'Updating live.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {groupedParticipants.map((entry) => (
                  <div key={entry.groupNumber} className="rounded-xl border border-slate-200 bg-white/80 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold text-slate-800">Group {entry.groupNumber}</p>
                      <span className="text-xs text-slate-500">
                        {entry.members.length}/{group.groupSize}
                      </span>
                    </div>
                    {entry.members.length === 0 ? (
                      <p className="text-xs text-slate-400">Waiting for participants...</p>
                    ) : (
                      <ul className="space-y-2 text-sm text-slate-700">
                        {entry.members.map(member => (
                          <li key={member.id} className="flex items-center justify-between">
                            <span>{displayName(member)}</span>
                            <span className="text-xs text-slate-400">Joined</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-lg shadow-slate-200/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Participants</CardTitle>
                <CardDescription>{participants.length} total responses</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {participants.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No participants yet</p>
                <p className="text-sm text-gray-500 mt-2">Share the QR code to start collecting names</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group</TableHead>
                      {group.fields.map((field) => (
                        <TableHead key={field.key}>{field.label}</TableHead>
                      ))}
                      <TableHead>Joined At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.map((participant) => (
                      <TableRow key={participant.id}>
                        <TableCell>Group {participant.assignedGroup}</TableCell>
                        {group.fields.map((field) => (
                          <TableCell key={field.key}>
                            {participant.data[field.key] || '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-sm text-gray-500">
                          {new Date(participant.joinedAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
