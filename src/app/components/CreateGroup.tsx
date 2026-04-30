import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { auth } from '../lib/auth';
import { api } from '../lib/api';
import { localStorage as localDB } from '../lib/localStorage';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Sparkles, Users2 } from 'lucide-react';

interface Field {
  key: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea';
  required: boolean;
}

interface Profile {
  name: string;
  email: string;
  subscription: 'free' | 'pro';
}

export function CreateGroup() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userMode, setUserMode] = useState<'anonymous' | 'authenticated'>('anonymous');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupCount, setGroupCount] = useState('6');
  const [groupSize, setGroupSize] = useState('4');
  const [nameLabel, setNameLabel] = useState('Participant Name');
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const session = await auth.getSession();
      if (session) {
        setUserMode('authenticated');
        const profileData = await api.getProfile(session.access_token);
        setProfile(profileData);
      } else {
        setUserMode('anonymous');
        setProfile({
          name: 'Anonymous Organizer',
          email: '',
          subscription: 'free'
        });
      }
    } catch {
      setUserMode('anonymous');
      setProfile({
        name: 'Anonymous Organizer',
        email: '',
        subscription: 'free'
      });
    }
  };

  const totalSeats = useMemo(() => {
    const count = Number.parseInt(groupCount, 10);
    const size = Number.parseInt(groupSize, 10);
    if (!Number.isFinite(count) || !Number.isFinite(size)) {
      return 0;
    }
    return Math.max(0, count) * Math.max(0, size);
  }, [groupCount, groupSize]);

  const isPro = profile?.subscription === 'pro';
  const isAnonymous = userMode !== 'authenticated';

  const addField = () => {
    setFields([...fields, { key: crypto.randomUUID(), label: '', type: 'text', required: false }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<Field>) => {
    setFields(fields.map((field, i) => i === index ? { ...field, ...updates } : field));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const count = Number.parseInt(groupCount, 10);
      const size = Number.parseInt(groupSize, 10);

      if (!name.trim()) {
        toast.error('Please name this event');
        setLoading(false);
        return;
      }

      if (!Number.isFinite(count) || count < 2) {
        toast.error('Number of groups must be at least 2');
        setLoading(false);
        return;
      }

      if (!Number.isFinite(size) || size < 2) {
        toast.error('Participants per group must be at least 2');
        setLoading(false);
        return;
      }

      const customFields = isPro
        ? fields.filter((field) => field.label.trim() !== '')
        : [];

      const groupData = {
        name: name.trim(),
        description: description.trim(),
        groupCount: count,
        groupSize: size,
        maxParticipants: count * size,
        nameField: 'name',
        fields: [
          {
            key: 'name',
            label: nameLabel.trim() || 'Participant Name',
            type: 'text',
            required: true
          },
          ...customFields
        ]
      };

      const session = await auth.getSession();

      if (session) {
        await api.createGroup(groupData, session.access_token);
      } else {
        const response = await api.createPublicGroup(groupData);
        const publicGroup = response.group;
        localDB.saveGroup({
          ...publicGroup,
          origin: 'public',
          organizerKey: response.organizerKey
        });
      }

      toast.success('Event created. Share the QR code to start!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error creating group:', error);
      toast.error(error.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2]">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
          <div className="text-sm text-gray-500">
            {userMode === 'authenticated' ? `${profile?.name}` : 'Free Mode'}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
          <Card className="border-none shadow-xl shadow-slate-200/60">
            <CardHeader>
              <CardTitle className="text-2xl">Create Group Flow</CardTitle>
              <CardDescription>
                Define the number of groups and seats, then share a QR so participants join instantly.
              </CardDescription>
            </CardHeader>
            <CardContent>
            {isAnonymous && (
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Guest events are shareable, but management access stays on this browser. Sign in to sync across devices.
              </div>
            )}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Event name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Leadership Workshop"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Add a short note participants will see."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="groupCount">Number of groups</Label>
                    <Input
                      id="groupCount"
                      type="number"
                      min="2"
                      value={groupCount}
                      onChange={(e) => setGroupCount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="groupSize">Participants per group</Label>
                    <Input
                      id="groupSize"
                      type="number"
                      min="2"
                      value={groupSize}
                      onChange={(e) => setGroupSize(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Total seats</p>
                      <p className="text-2xl font-semibold text-slate-900">{totalSeats || '--'}</p>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                      Seats are filled automatically when participants join.
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Participant details</Label>
                      <p className="text-xs text-slate-500">This name appears on group rosters.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nameLabel">Name field label</Label>
                    <Input
                      id="nameLabel"
                      value={nameLabel}
                      onChange={(e) => setNameLabel(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Custom questions</Label>
                      <p className="text-xs text-slate-500">Collect extra details from participants.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addField}
                      disabled={!isPro}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add question
                    </Button>
                  </div>

                  {!isPro && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Pro feature: add custom questions, export data, and remove branding.
                      <Link to="/pricing" className="ml-2 font-semibold underline">
                        Upgrade
                      </Link>
                    </div>
                  )}

                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.key} className="flex gap-2 items-start p-3 border rounded-lg bg-white">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Question label"
                            value={field.label}
                            onChange={(e) => updateField(index, { label: e.target.value })}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Select
                              value={field.type}
                              onValueChange={(value) => updateField(index, { type: value as Field['type'] })}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="tel">Phone</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="textarea">Long Text</SelectItem>
                              </SelectContent>
                            </Select>

                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`required-${index}`}
                                checked={field.required}
                                onCheckedChange={(checked) => updateField(index, { required: !!checked })}
                              />
                              <Label htmlFor={`required-${index}`} className="text-sm cursor-pointer">
                                Required
                              </Label>
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeField(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Event'}
                  </Button>
                  <Link to="/dashboard" className="flex-1">
                    <Button type="button" variant="outline" className="w-full">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-none shadow-lg shadow-slate-200/60 bg-gradient-to-br from-slate-900 to-slate-700 text-white">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Smart Grouping
                </CardTitle>
                <CardDescription className="text-slate-200">
                  Participants are assigned the moment they join. No manual sorting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-100">
                <div className="flex items-center gap-3">
                  <Users2 className="h-5 w-5" />
                  <span>Randomly balanced groups</span>
                </div>
                <div className="flex items-center gap-3">
                  <Users2 className="h-5 w-5" />
                  <span>Participants see groupmates instantly</span>
                </div>
                <div className="flex items-center gap-3">
                  <Users2 className="h-5 w-5" />
                  <span>Designed for workshops and team rotations</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white/80">
              <CardHeader>
                <CardTitle className="text-lg">Pro insights</CardTitle>
                <CardDescription>Keep tabs on signups in real time.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2">
                <p>Export participant rosters and group assignments as CSV.</p>
                <p>Collect custom answers like department or experience level.</p>
                <p>Remove branding and add your own event logo.</p>
                <Link to="/pricing" className="text-slate-900 font-semibold underline">
                  Explore Pro
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
