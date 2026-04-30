// Local storage system for anonymous users
export interface LocalGroup {
  id: string;
  name: string;
  slug?: string;
  description: string;
  subscription?: 'free' | 'pro';
  branding?: boolean;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'email' | 'tel' | 'number' | 'textarea';
    required: boolean;
  }[];
  nameField: string;
  groupCount: number;
  groupSize: number;
  maxParticipants: number | null;
  createdAt: string;
  participantCount: number;
  origin?: 'local' | 'public';
  organizerKey?: string;
}

export interface LocalParticipant {
  id: string;
  groupId: string;
  data: Record<string, any>;
  assignedGroup: number;
  joinedAt: string;
}

const GROUPS_KEY = 'groupsync_local_groups';
const PARTICIPANTS_KEY = 'groupsync_local_participants';

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60) || 'event';
};

type LocalGroupInput = Omit<LocalGroup, 'createdAt' | 'participantCount'> & {
  id?: string;
  createdAt?: string;
  participantCount?: number;
};

export const localStorage = {
  // Groups
  getGroups(): LocalGroup[] {
    try {
      const data = window.localStorage.getItem(GROUPS_KEY);
      const groups = data ? JSON.parse(data) : [];
      return groups.map((group: any) => this.normalizeGroup(group));
    } catch {
      return [];
    }
  },

  getGroup(groupId: string): LocalGroup | null {
    const groups = this.getGroups();
    return groups.find(g => g.id === groupId) || null;
  },

  saveGroup(group: LocalGroupInput): LocalGroup {
    const groups = this.getGroups();
    const newGroup: LocalGroup = this.normalizeGroup({
      ...group,
      id: group.id || crypto.randomUUID(),
      createdAt: group.createdAt || new Date().toISOString(),
      participantCount: group.participantCount || 0
    });
    groups.push(newGroup);
    window.localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    return newGroup;
  },

  deleteGroup(groupId: string): void {
    const groups = this.getGroups().filter(g => g.id !== groupId);
    window.localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));

    // Also delete associated participants
    const participants = this.getParticipants().filter(p => p.groupId !== groupId);
    window.localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(participants));
  },

  // Participants
  getParticipants(groupId?: string): LocalParticipant[] {
    try {
      const data = window.localStorage.getItem(PARTICIPANTS_KEY);
      const allParticipants: LocalParticipant[] = data ? JSON.parse(data) : [];
      if (!groupId) {
        return allParticipants;
      }

      const group = this.getGroup(groupId);
      if (!group) {
        return allParticipants.filter(p => p.groupId === groupId);
      }

      if (group.origin === 'public') {
        return [];
      }

      const groupParticipants = allParticipants.filter(p => p.groupId === groupId);
      let updated = false;
      const normalized = groupParticipants.map((participant, index) => {
        if (participant.assignedGroup) {
          return participant;
        }
        updated = true;
        return {
          ...participant,
          assignedGroup: (index % group.groupCount) + 1
        };
      });

      if (updated) {
        const merged = allParticipants.map((participant) => {
          if (participant.groupId !== groupId) {
            return participant;
          }
          return normalized.find(p => p.id === participant.id) ?? participant;
        });
        window.localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(merged));
      }

      return normalized;
    } catch {
      return [];
    }
  },

  addParticipant(groupId: string, data: Record<string, any>): LocalParticipant {
    const group = this.getGroup(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (group.origin === 'public') {
      throw new Error('Public groups should be updated via the API');
    }

    const participants = this.getParticipants();
    const groupParticipants = participants.filter(p => p.groupId === groupId);

    if (group.maxParticipants && groupParticipants.length >= group.maxParticipants) {
      throw new Error('Group is full');
    }

    const assignedGroup = this.pickGroupAssignment(group, groupParticipants);
    const newParticipant: LocalParticipant = {
      id: crypto.randomUUID(),
      groupId,
      data,
      assignedGroup,
      joinedAt: new Date().toISOString()
    };

    participants.push(newParticipant);
    window.localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(participants));

    // Update participant count
    const groups = this.getGroups();
    const groupIndex = groups.findIndex(g => g.id === groupId);
    if (groupIndex !== -1) {
      groups[groupIndex].participantCount = this.getParticipants(groupId).length;
      window.localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    }

    return newParticipant;
  },

  // Check if user has reached free limit
  hasReachedFreeLimit(): boolean {
    return this.getGroups().length >= 3;
  },

  // Clear all local data (for upgrading to Pro)
  clearLocalData(): void {
    window.localStorage.removeItem(GROUPS_KEY);
    window.localStorage.removeItem(PARTICIPANTS_KEY);
  },

  normalizeGroup(group: any): LocalGroup {
    const rawFields = Array.isArray(group?.fields) ? group.fields : [];
    const fields = rawFields.map((field: any, index: number) => {
      const key = field.key || field.name || `field_${index + 1}`;
      const label = field.label || field.name || `Field ${index + 1}`;
      return {
        key,
        label,
        type: field.type || 'text',
        required: !!field.required
      };
    });

    const nameField = group.nameField || fields[0]?.key || 'name';
    const groupCount = Number(group.groupCount || group.groupsCount || 2);
    const groupSize = Number(group.groupSize || group.sizePerGroup || 4);
    const maxParticipants = group.maxParticipants ?? (groupCount * groupSize);

    return {
      id: group.id,
      name: group.name || 'Untitled Group',
      slug: group.slug || slugify(group.name || 'event'),
      description: group.description || '',
      fields: fields.length > 0 ? fields : [{
        key: 'name',
        label: 'Participant Name',
        type: 'text',
        required: true
      }],
      nameField,
      subscription: group.subscription || 'free',
      branding: group.branding !== false,
      groupCount: Number.isFinite(groupCount) && groupCount > 0 ? groupCount : 2,
      groupSize: Number.isFinite(groupSize) && groupSize > 0 ? groupSize : 4,
      maxParticipants: Number.isFinite(maxParticipants) ? maxParticipants : null,
      createdAt: group.createdAt || new Date().toISOString(),
      participantCount: group.participantCount || 0,
      origin: group.origin || 'local',
      organizerKey: group.organizerKey
    };
  },

  pickGroupAssignment(group: LocalGroup, participants: LocalParticipant[]): number {
    const counts = Array.from({ length: group.groupCount }, () => 0);
    participants.forEach(participant => {
      if (participant.assignedGroup && participant.assignedGroup <= group.groupCount) {
        counts[participant.assignedGroup - 1] += 1;
      }
    });

    const available = counts
      .map((count, index) => ({ count, index }))
      .filter(entry => entry.count < group.groupSize);

    if (available.length === 0) {
      throw new Error('Group is full');
    }

    const minCount = Math.min(...available.map(entry => entry.count));
    const candidates = available.filter(entry => entry.count === minCount);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return pick.index + 1;
  }
};
