import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { api } from '../lib/api';
import { localStorage as localDB } from '../lib/localStorage';
import { toast } from 'sonner';
import { Users, CheckCircle2, Sparkles } from 'lucide-react';

interface Field {
  key: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea';
  required: boolean;
}

interface Group {
  id: string;
  name: string;
  description: string;
  fields: Field[];
  nameField: string;
  subscription?: 'free' | 'pro';
  branding?: boolean;
  groupCount: number;
  groupSize: number;
  maxParticipants: number;
  participantCount: number;
}

interface PublicParticipant {
  id: string;
  displayName: string;
  assignedGroup: number;
  joinedAt: string;
}

export function JoinGroup() {
  const { userId, groupId } = useParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [assignedGroup, setAssignedGroup] = useState<number | null>(null);
  const [groupmates, setGroupmates] = useState<PublicParticipant[]>([]);
  const [totalJoined, setTotalJoined] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    loadGroup();
  }, [userId, groupId]);

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
    return Math.max(0, totalSeats - (group.participantCount || 0));
  }, [group, totalSeats]);

  const refreshLiveStatus = async (groupNumber: number) => {
    if (!group) {
      return;
    }

    try {
      let participants: PublicParticipant[] = [];

      if (userId === 'public') {
        const response = await api.getPublicParticipantsPublic(groupId!);
        participants = response.participants || [];
      } else if (userId === 'local') {
        const localParticipants = localDB.getParticipants(groupId!);
        participants = localParticipants.map((participant) => ({
          id: participant.id,
          displayName: participant.data?.[group.nameField || 'name'] || 'Participant',
          assignedGroup: participant.assignedGroup,
          joinedAt: participant.joinedAt
        }));
      } else {
        const response = await api.getPublicParticipants(userId!, groupId!);
        participants = response.participants || [];
      }

      const total = participants.length;
      const mates = participants.filter((participant) => participant.assignedGroup === groupNumber);

      setTotalJoined(total);
      setGroupmates(mates);
      setGroup(prev => prev ? { ...prev, participantCount: total } : prev);
      if (group.maxParticipants) {
        setIsComplete(total >= group.maxParticipants);
      }
    } catch (error) {
      console.error('Failed to refresh live status:', error);
    }
  };

  const normalizeFields = (rawFields: any[]): Field[] => {
    return (rawFields || []).map((field, index) => ({
      key: field.key || field.name || `field_${index + 1}`,
      label: field.label || field.name || `Field ${index + 1}`,
      type: field.type || 'text',
      required: !!field.required
    }));
  };

  const loadGroup = async () => {
    try {
      let groupData: Group;

      if (userId === 'public') {
        groupData = await api.getPublicGroup(groupId!);
      } else if (userId === 'local') {
        let localGroup = localDB.getGroup(groupId!);
        if (!localGroup) {
          localGroup = localDB.getGroups().find(group => group.slug === groupId) || null;
        }
        if (!localGroup) {
          setGroup(null);
          setLoading(false);
          return;
        }
        groupData = localGroup as unknown as Group;
      } else {
        groupData = await api.getGroup(userId!, groupId!);
      }

      const normalizedFields = normalizeFields(groupData.fields as any[]);
      const resolvedGroupCount = groupData.groupCount || 2;
      const resolvedGroupSize = groupData.groupSize || 4;
      const normalizedGroup = {
        ...groupData,
        fields: normalizedFields,
        nameField: groupData.nameField || normalizedFields[0]?.key || 'name',
        groupCount: resolvedGroupCount,
        groupSize: resolvedGroupSize,
        maxParticipants: groupData.maxParticipants || (resolvedGroupCount * resolvedGroupSize)
      };

      setGroup(normalizedGroup);

      const initialData: Record<string, string> = {};
      normalizedFields.forEach((field) => {
        initialData[field.key] = '';
      });
      setFormData(initialData);
    } catch (error: any) {
      console.error('Error loading group:', error);
      toast.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupmates = async (groupNumber: number) => {
    try {
      if (userId === 'public') {
        const response = await api.getPublicParticipantsPublic(groupId!);
        const mates = (response.participants || [])
          .filter((participant: PublicParticipant) => participant.assignedGroup === groupNumber);
        setGroupmates(mates);
        return;
      }

      if (userId === 'local') {
        const participants = localDB.getParticipants(groupId!);
        const mates = participants
          .filter(p => p.assignedGroup === groupNumber)
          .map((p) => ({
            id: p.id,
            displayName: p.data?.[group?.nameField || 'name'] || 'Participant',
            assignedGroup: p.assignedGroup,
            joinedAt: p.joinedAt
          }));
        setGroupmates(mates);
        return;
      }

      const response = await api.getPublicParticipants(userId!, groupId!);
      const mates = (response.participants || [])
        .filter((participant: PublicParticipant) => participant.assignedGroup === groupNumber);
      setGroupmates(mates);
      setTotalJoined((response.participants || []).length);
    } catch (error) {
      console.error('Failed to load groupmates:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) {
      return;
    }

    setSubmitting(true);

    try {
      const missingFields = group.fields
        .filter((field) => field.required && !formData[field.key]?.trim())
        .map((field) => field.label);

      if (missingFields.length > 0) {
        toast.error(`Please fill in: ${missingFields.join(', ')}`);
        setSubmitting(false);
        return;
      }

      if (group.maxParticipants && group.participantCount >= group.maxParticipants) {
        toast.error('This event is full');
        setSubmitting(false);
        return;
      }

      if (userId === 'local') {
        const participant = localDB.addParticipant(groupId!, formData);
        setAssignedGroup(participant.assignedGroup);
        setSubmitted(true);
        await loadGroupmates(participant.assignedGroup);
        setTotalJoined(localDB.getParticipants(groupId!).length);
        if (group.maxParticipants) {
          setIsComplete(localDB.getParticipants(groupId!).length >= group.maxParticipants);
        }
      } else if (userId === 'public') {
        const response = await api.addPublicParticipant(groupId!, formData);
        const participantGroup = response.participant?.assignedGroup;
        setAssignedGroup(participantGroup || null);
        setSubmitted(true);
        if (participantGroup) {
          await loadGroupmates(participantGroup);
        }
      } else {
        const response = await api.addParticipant(userId!, groupId!, formData);
        let participantGroup = response.participant?.assignedGroup;
        if (!participantGroup && response.participant?.id) {
          try {
            const publicResponse = await api.getPublicParticipants(userId!, groupId!);
            const match = (publicResponse.participants || []).find((participant: PublicParticipant) => participant.id === response.participant.id);
            participantGroup = match?.assignedGroup;
          } catch {
            // Ignore fallback errors
          }
        }
        setAssignedGroup(participantGroup || null);
        setSubmitted(true);
        if (participantGroup) {
          await loadGroupmates(participantGroup);
        }
      }

      toast.success('You are in!');
    } catch (error: any) {
      console.error('Error joining group:', error);
      toast.error(error.message || 'Failed to join');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (fieldKey: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldKey]: value }));
  };

  useEffect(() => {
    if (!submitted || !assignedGroup || !group) {
      return;
    }

    refreshLiveStatus(assignedGroup);
    const interval = window.setInterval(() => {
      refreshLiveStatus(assignedGroup);
    }, 4000);

    return () => {
      window.clearInterval(interval);
    };
  }, [submitted, assignedGroup, group?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f6f2]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading event...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f6f2] p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 mb-4">Event not found</p>
            <Link to="/">
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted && assignedGroup) {
    const seatsRemaining = group ? Math.max(0, (group.maxParticipants || 0) - totalJoined) : 0;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f6f2] p-4">
        <Card className="max-w-lg w-full border-none shadow-xl shadow-slate-200/60">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">You are in Group {assignedGroup}</h2>
            <p className="text-gray-600 mb-4">
              This page will stay open and update as more people join.
            </p>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left mb-6">
              <p className="text-sm font-semibold text-slate-700 mb-2">Groupmates</p>
              {groupmates.length === 0 ? (
                <p className="text-sm text-slate-500">We are still matching others. Check back soon.</p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-700">
                  {groupmates.map((mate) => (
                    <li key={mate.id} className="flex items-center justify-between">
                      <span>{mate.displayName}</span>
                      <span className="text-xs text-slate-400">Group {mate.assignedGroup}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 mb-4">
              {isComplete ? (
                <span>All participants have joined.</span>
              ) : (
                <span>Waiting for {seatsRemaining} more participant{seatsRemaining === 1 ? '' : 's'}.</span>
              )}
            </div>

            <Link to="/">
              <Button className="w-full" variant={isComplete ? 'default' : 'outline'}>
                {isComplete ? 'Done' : 'Leave Page'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted && !assignedGroup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f6f2] p-4">
        <Card className="max-w-lg w-full border-none shadow-xl shadow-slate-200/60">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">You are in!</h2>
            <p className="text-gray-600 mb-6">
              We are assigning your group now. Please refresh this page in a moment to see your groupmates.
            </p>
            <Button className="w-full" onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f2] p-4">
      <div className="container mx-auto py-8 max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm text-slate-700 shadow">
            <Sparkles className="h-4 w-4" />
            You are joining {group.name}
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900">{group.name}</h1>
          <p className="text-slate-600 mt-2">{group.description || 'Add your name to get your group assignment.'}</p>
        </div>

        <Card className="border-none shadow-xl shadow-slate-200/60">
          <CardHeader>
            <CardTitle>Join the event</CardTitle>
            <CardDescription>
              {group.groupCount} groups, {group.groupSize} people each. {remainingSeats} spots left.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {group.fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>

                  {field.type === 'textarea' ? (
                    <Textarea
                      id={field.key}
                      value={formData[field.key] || ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      required={field.required}
                      rows={4}
                    />
                  ) : (
                    <Input
                      id={field.key}
                      type={field.type}
                      value={formData[field.key] || ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      required={field.required}
                    />
                  )}
                </div>
              ))}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Joining...' : 'Join & Get My Group'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-500 mt-6 flex items-center justify-center gap-2">
          <Users className="h-4 w-4" />
          Groups are randomized as people join.
        </p>
        {group.branding !== false && (
          <p className="text-center text-xs text-slate-400 mt-4">
            Powered by Organise Us
          </p>
        )}
      </div>
    </div>
  );
}
