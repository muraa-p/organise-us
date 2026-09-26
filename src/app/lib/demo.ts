/**
 * Demo mode — runs the whole app with zero backend.
 *
 * Used when no Supabase credentials are configured (VITE_SUPABASE_URL /
 * VITE_SUPABASE_ANON_KEY are absent). Every write goes to localStorage, and a
 * small set of realistic records is seeded on first run so the UI has something
 * to show instead of an empty state.
 *
 * The real Supabase code paths are untouched: set the env vars and the app uses
 * the live database exactly as before.
 */
import { localStorage as localDB, LocalGroup } from './localStorage';

export const DEMO_EMAIL = 'demo@organise.us';
export const DEMO_PASSWORD = 'demo1234';
const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
const SESSION_KEY = 'groupsync_demo_session';

export const isDemoMode = true;

// --- fake Supabase-shaped session -------------------------------------------
function makeSession() {
  const expires_at = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  return {
    access_token: 'demo-access-token',
    refresh_token: 'demo-refresh-token',
    token_type: 'bearer',
    expires_in: expires_at,
    expires_at,
    user: {
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      user_metadata: { name: 'Demo Organiser' },
    },
  };
}

// --- seed data ---------------------------------------------------------------
const SEED_FLAG = 'groupsync_demo_seeded';

function seed() {
  if (window.localStorage.getItem(SEED_FLAG)) return;
  if (localDB.getGroups().length > 0) {
    window.localStorage.setItem(SEED_FLAG, '1');
    return;
  }

  const alumni: LocalGroup = {
    id: 'demo-group-alumni',
    name: 'Class of 2024 Reunion',
    slug: 'class-of-2024-reunion',
    description: 'Reunion weekend — three days, three groups, one very full schedule.',
    subscription: 'free',
    branding: true,
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'year', label: 'Graduation year', type: 'number', required: true },
      { key: 'dietary', label: 'Dietary notes', type: 'text', required: false },
    ],
    nameField: 'name',
    groupCount: 3,
    groupSize: 4,
    maxParticipants: 12,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 21).toISOString(),
    participantCount: 0,
    origin: 'local',
  };

  const volunteers: LocalGroup = {
    id: 'demo-group-volunteers',
    name: 'Weekend Volunteers',
    slug: 'weekend-volunteers',
    description: 'Sign-up sheet for the community clean-up. Groups of six per shift.',
    subscription: 'free',
    branding: true,
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'tel', required: true },
      { key: 'shift', label: 'Preferred shift', type: 'text', required: true },
    ],
    nameField: 'name',
    groupCount: 2,
    groupSize: 3,
    maxParticipants: 6,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
    participantCount: 0,
    origin: 'local',
  };

  localDB.saveGroup(alumni);
  localDB.saveGroup(volunteers);

  const alumniPeople: Array<[string, string, string, string]> = [
    ['Amina Warsame', 'amina@example.com', '2024', 'Vegetarian'],
    ['Abdi Hussein', 'abdi@example.com', '2024', ''],
    ['Fadumo Ali', 'fadumo@example.com', '2023', 'Nut allergy'],
    ['Ibrahim Noor', 'ibrahim@example.com', '2024', ''],
    ['Khadija Osman', 'khadija@example.com', '2024', 'Halal'],
    ['Mohamed Jama', 'mohamed@example.com', '2022', ''],
  ];
  alumniPeople.forEach(([name, email, year, dietary]) => {
    try {
      localDB.addParticipant(alumni.id, { name, email, year, dietary });
    } catch { /* group may be full; ignore */ }
  });

  const volunteerPeople: Array<[string, string, string]> = [
    ['Layla Ismail', '+252 61 000 0001', 'Saturday morning'],
    ['Yusuf Aden', '+252 61 000 0002', 'Saturday afternoon'],
    ['Sahra Nur', '+252 61 000 0003', 'Sunday morning'],
  ];
  volunteerPeople.forEach(([name, phone, shift]) => {
    try {
      localDB.addParticipant(volunteers.id, { name, phone, shift });
    } catch { /* ignore */ }
  });

  window.localStorage.setItem(SEED_FLAG, '1');
}

// --- mock auth ---------------------------------------------------------------
export const demoAuth = {
  async signIn(email: string, password: string) {
    seed();
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      throw new Error('Use the demo account shown on this page.');
    }
    const session = makeSession();
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { user: session.user, session };
  },
  async signUp() {
    throw new Error('Sign-up is disabled in the demo. Connect Supabase to enable it.');
  },
  async signOut() {
    window.localStorage.removeItem(SESSION_KEY);
  },
  async getSession() {
    seed();
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  },
  async getUser() {
    const s = await this.getSession();
    if (!s) throw new Error('No session');
    return s.user;
  },
  async refreshSession() {
    const s = await this.getSession();
    return { session: s, user: s?.user ?? null };
  },
};

// --- mock api (same surface as src/app/lib/api.ts) ---------------------------
const profile = {
  id: DEMO_USER_ID,
  email: DEMO_EMAIL,
  name: 'Demo Organiser',
  subscription: 'pro' as const,
  demo: true,
};

const billingStub = async () => {
  throw new Error('Billing is disabled in the demo.');
};

export const demoApi = {
  async getProfile() {
    seed();
    return { ...profile };
  },
  async getGroups() {
    seed();
    return { groups: localDB.getGroups() };
  },
  async getGroup(_userId: string, groupId: string) {
    seed();
    const group = localDB.getGroup(groupId);
    if (!group) throw new Error('Group not found');
    return { group };
  },
  async createGroup(groupData: any) {
    seed();
    const group = localDB.saveGroup({ ...groupData, origin: 'local' });
    return { group };
  },
  async deleteGroup(groupId: string) {
    seed();
    localDB.deleteGroup(groupId);
    return { ok: true };
  },
  async getParticipants(groupId: string) {
    seed();
    return { participants: localDB.getParticipants(groupId) };
  },
  async addParticipant(_userId: string, groupId: string, data: any) {
    seed();
    return { participant: localDB.addParticipant(groupId, data) };
  },
  // public group endpoints fall back to the same local store
  async getPublicGroup(groupId: string) {
    seed();
    const group = localDB.getGroup(groupId);
    if (!group) throw new Error('Group not found');
    return { group };
  },
  async createPublicGroup(groupData: any) {
    return this.createGroup({ ...groupData, origin: 'public' });
  },
  async getPublicParticipants(groupId: string) {
    return this.getParticipants(groupId);
  },
  async getPublicParticipantsPublic(groupId: string) {
    return this.getParticipants(groupId);
  },
  async getPublicParticipantsOwner(groupId: string) {
    return this.getParticipants(groupId);
  },
  async addPublicParticipant(groupId: string, data: any) {
    return this.addParticipant(DEMO_USER_ID, groupId, data);
  },
  async deletePublicGroup(groupId: string) {
    return this.deleteGroup(groupId);
  },
  async subscribe() {
    return { ok: true };
  },
  async createCheckoutSession() {
    return billingStub();
  },
  async createPortalSession() {
    return billingStub();
  },
};
