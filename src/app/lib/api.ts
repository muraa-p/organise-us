import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-1a98deae`;

async function fetchAPI(endpoint: string, options: RequestInit = {}, token?: string) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token || publicAnonKey}`,
    ...options.headers,
  };

  console.log(`API Request [${endpoint}]:`, {
    url: `${API_URL}${endpoint}`,
    token: token ? `${token.substring(0, 20)}...` : 'using anon key',
    hasToken: !!token
  });

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const rawText = await response.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText ? { raw: rawText } : null;
  }

  if (!response.ok) {
    console.error(`API Error [${endpoint}]:`, {
      status: response.status,
      statusText: response.statusText,
      error: data?.error,
      data,
      rawText
    });
    throw new Error(
      data?.error ||
      data?.message ||
      (rawText ? rawText.slice(0, 200) : '') ||
      `API request failed: ${response.status}`
    );
  }

  return data ?? {};
}

export const api = {
  async getProfile(token: string) {
    return fetchAPI('/profile', {}, token);
  },

  async subscribe(plan: 'free' | 'pro', token: string) {
    return fetchAPI('/subscribe', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }, token);
  },

  async createCheckoutSession(token: string) {
    return fetchAPI('/billing/checkout', {
      method: 'POST',
    }, token);
  },

  async createPortalSession(token: string) {
    return fetchAPI('/billing/portal', {
      method: 'POST',
    }, token);
  },

  async createGroup(groupData: any, token: string) {
    return fetchAPI('/groups', {
      method: 'POST',
      body: JSON.stringify(groupData),
    }, token);
  },

  async getGroups(token: string) {
    return fetchAPI('/groups', {}, token);
  },

  async getGroup(userId: string, groupId: string) {
    return fetchAPI(`/groups/${userId}/${groupId}`, {});
  },

  async deleteGroup(groupId: string, token: string) {
    return fetchAPI(`/groups/${groupId}`, {
      method: 'DELETE',
    }, token);
  },

  async getParticipants(groupId: string, token: string) {
    return fetchAPI(`/groups/${groupId}/participants`, {}, token);
  },

  async addParticipant(userId: string, groupId: string, data: any) {
    return fetchAPI(`/groups/${userId}/${groupId}/participants`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getPublicParticipants(userId: string, groupId: string) {
    return fetchAPI(`/groups/${userId}/${groupId}/participants/public`, {});
  },

  async createPublicGroup(groupData: any) {
    return fetchAPI('/groups/public', {
      method: 'POST',
      body: JSON.stringify(groupData),
    });
  },

  async getPublicGroup(groupId: string) {
    return fetchAPI(`/groups/public/${groupId}`, {});
  },

  async addPublicParticipant(groupId: string, data: any) {
    return fetchAPI(`/groups/public/${groupId}/participants`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getPublicParticipantsPublic(groupId: string) {
    return fetchAPI(`/groups/public/${groupId}/participants/public`, {});
  },

  async getPublicParticipantsOwner(groupId: string, organizerKey: string) {
    return fetchAPI(`/groups/public/${groupId}/participants`, {
      headers: {
        'X-Organizer-Key': organizerKey
      }
    });
  },

  async deletePublicGroup(groupId: string, organizerKey: string) {
    return fetchAPI(`/groups/public/${groupId}`, {
      method: 'DELETE',
      headers: {
        'X-Organizer-Key': organizerKey
      }
    });
  },
};
