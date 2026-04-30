import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";
import * as kv from "./kv_store.ts";

const app = new Hono().basePath("/make-server-1a98deae");

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Organizer-Key"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Create Supabase clients (singleton pattern)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
);

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60) || 'event';
};

const shortId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

const findUserGroupBySlug = async (userId: string, slug: string) => {
  const groups = await kv.getByPrefixWithKeys(`group:${userId}:`);
  const match = (groups || []).find((entry: any) => entry.value?.slug === slug);
  return match ? { group: match.value, key: match.key } : null;
};

const findPublicGroupBySlug = async (slug: string) => {
  const groups = await kv.getByPrefixWithKeys(`group:public:`);
  const match = (groups || []).find((entry: any) => entry.value?.slug === slug);
  return match ? { group: match.value, key: match.key } : null;
};

const ensureUniqueUserSlug = async (userId: string, name: string) => {
  const base = slugify(name);
  let slug = base;
  let attempt = 0;
  while (attempt < 5) {
    const existing = await findUserGroupBySlug(userId, slug);
    if (!existing) {
      return slug;
    }
    slug = `${base}-${shortId()}`;
    attempt += 1;
  }
  return `${base}-${shortId()}`;
};

const ensureUniquePublicSlug = async (name: string) => {
  const base = slugify(name);
  let slug = base;
  let attempt = 0;
  while (attempt < 5) {
    const existing = await findPublicGroupBySlug(slug);
    if (!existing) {
      return slug;
    }
    slug = `${base}-${shortId()}`;
    attempt += 1;
  }
  return `${base}-${shortId()}`;
};

const resolveUserGroup = async (userId: string, groupIdOrSlug: string) => {
  const directKey = `group:${userId}:${groupIdOrSlug}`;
  const direct = await kv.get(directKey);
  if (direct) {
    return { group: direct, groupId: direct.id || groupIdOrSlug, key: directKey };
  }
  const bySlug = await findUserGroupBySlug(userId, groupIdOrSlug);
  if (bySlug?.group) {
    return { group: bySlug.group, groupId: bySlug.group.id, key: bySlug.key };
  }
  const all = await kv.getByPrefixWithKeys(`group:${userId}:`);
  const byId = (all || []).find((entry: any) => entry.value?.id === groupIdOrSlug);
  if (!byId) {
    return null;
  }
  return { group: byId.value, groupId: byId.value.id, key: byId.key };
};

const resolvePublicGroup = async (groupIdOrSlug: string) => {
  const directKey = `group:public:${groupIdOrSlug}`;
  const direct = await kv.get(directKey);
  if (direct) {
    return { group: direct, groupId: direct.id || groupIdOrSlug, key: directKey };
  }
  const bySlug = await findPublicGroupBySlug(groupIdOrSlug);
  if (bySlug?.group) {
    return { group: bySlug.group, groupId: bySlug.group.id, key: bySlug.key };
  }
  const all = await kv.getByPrefixWithKeys(`group:public:`);
  const byId = (all || []).find((entry: any) => entry.value?.id === groupIdOrSlug);
  if (!byId) {
    return null;
  }
  return { group: byId.value, groupId: byId.value.id, key: byId.key };
};

const getAdminProEmails = () => {
  const raw = Deno.env.get("ADMIN_PRO_EMAILS") ?? "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

const getAdminProDomains = () => {
  const raw = Deno.env.get("ADMIN_PRO_DOMAINS") ?? "";
  return raw
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
};

const isAdminPro = (email?: string | null) => {
  if (!email) {
    return false;
  }
  const normalized = email.toLowerCase();
  const adminEmails = getAdminProEmails();
  if (adminEmails.includes(normalized)) {
    return true;
  }
  const adminDomains = getAdminProDomains();
  const domain = normalized.split("@")[1] ?? "";
  return adminDomains.includes(domain);
};

const getSiteUrl = (c: any) => {
  const configured = Deno.env.get("PUBLIC_SITE_URL");
  if (configured) {
    return configured;
  }
  const origin = c.req.header("Origin");
  if (origin) {
    return origin;
  }
  const referer = c.req.header("Referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // Ignore malformed referer.
    }
  }
  return "http://localhost:5173";
};

const getStripeClient = () => {
  const secret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!secret) {
    throw new Error("Stripe secret key not configured");
  }
  return new Stripe(secret, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });
};

const updateProfileSubscription = async (
  userId: string,
  patch: Record<string, unknown>,
) => {
  const existing = await kv.get(`user:${userId}`);
  const baseProfile = existing || {
    id: userId,
    email: patch.email || null,
    name: patch.name || (typeof patch.email === "string" ? patch.email.split("@")[0] : "User"),
    subscription: "free",
    createdAt: new Date().toISOString(),
  };

  const updatedProfile = {
    ...baseProfile,
    ...patch,
  };
  await kv.set(`user:${userId}`, updatedProfile);
  return updatedProfile;
};

// Helper to get authenticated user
const getAuthUser = async (authHeader: string | null) => {
  if (!authHeader) {
    console.log('No authorization header provided');
    return null;
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    console.log('No token in authorization header');
    return null;
  }
  
  // Skip validation if it's the anon key itself
  if (token === Deno.env.get('SUPABASE_ANON_KEY')) {
    console.log('Received anon key instead of user token');
    return null;
  }
  
  try {
    // Create a client with the user's token to validate it
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.log(`Auth error: ${error.message}`, error);
      return null;
    }
    
    if (!user) {
      console.log('No user found for token');
      return null;
    }
    
    console.log(`Authenticated user: ${user.id}`);
    return user;
  } catch (error) {
    console.log(`Exception during auth: ${error}`);
    return null;
  }
};

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// Sign up endpoint
app.post("/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    if (!email || !password || !name) {
      return c.json({ error: "Email, password, and name are required" }, 400);
    }

    const supabase = supabaseAdmin;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.log(`Error creating user during signup: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    // Create user profile with free tier
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email,
      name,
      subscription: 'free',
      subscriptionSource: 'free',
      createdAt: new Date().toISOString()
    });

    return c.json({ user: data.user });
  } catch (error) {
    console.log(`Unexpected error during signup: ${error}`);
    return c.json({ error: "Failed to create user" }, 500);
  }
});

// Get current user profile
app.get("/profile", async (c) => {
  const user = await getAuthUser(c.req.header('Authorization') ?? null);
  if (!user) {
    console.log('Profile request unauthorized - no valid user token');
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    let profile = await kv.get(`user:${user.id}`);
    
    // If profile doesn't exist, create it (for existing auth users)
    if (!profile) {
      console.log(`Creating profile for existing user: ${user.id}`);
      profile = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        subscription: 'free',
        subscriptionSource: 'free',
        createdAt: new Date().toISOString()
      };
      await kv.set(`user:${user.id}`, profile);
    }

    if (isAdminPro(user.email)) {
      return c.json({ ...profile, subscription: 'pro', subscriptionSource: 'admin' });
    }

    return c.json(profile);
  } catch (error) {
    console.log(`Error fetching profile for user ${user.id}: ${error}`);
    return c.json({ error: "Failed to fetch profile" }, 500);
  }
});

// Update subscription
app.post("/subscribe", async (c) => {
  const user = await getAuthUser(c.req.header('Authorization') ?? null);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { plan } = await c.req.json();
    
    if (plan !== 'free' && plan !== 'pro') {
      return c.json({ error: "Invalid plan" }, 400);
    }

    const profile = await kv.get(`user:${user.id}`);
    if (!profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    if (isAdminPro(user.email)) {
      const updatedProfile = {
        ...profile,
        subscription: 'pro',
        subscriptionDate: new Date().toISOString(),
        subscriptionSource: 'admin'
      };
      await kv.set(`user:${user.id}`, updatedProfile);
      return c.json({ success: true, profile: updatedProfile });
    }

    if (plan === 'pro') {
      return c.json({ error: "Upgrade via checkout to enable Pro." }, 403);
    }

    const updatedProfile = {
      ...profile,
      subscription: plan,
      subscriptionDate: plan === 'pro' ? new Date().toISOString() : null,
      subscriptionSource: 'free'
    };

    await kv.set(`user:${user.id}`, updatedProfile);
    
    return c.json({ success: true, profile: updatedProfile });
  } catch (error) {
    console.log(`Error updating subscription: ${error}`);
    return c.json({ error: "Failed to update subscription" }, 500);
  }
});

// Create Stripe checkout session
app.post("/billing/checkout", async (c) => {
  const user = await getAuthUser(c.req.header("Authorization") ?? null);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const priceId = Deno.env.get("STRIPE_PRICE_ID") ?? "";
    if (!priceId) {
      return c.json({ error: "Stripe price ID not configured" }, 500);
    }

    const siteUrl = getSiteUrl(c);
    const successUrl = Deno.env.get("STRIPE_SUCCESS_URL") ?? `${siteUrl}/pricing?checkout=success`;
    const cancelUrl = Deno.env.get("STRIPE_CANCEL_URL") ?? `${siteUrl}/pricing?checkout=cancel`;

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          userId: user.id,
          email: user.email ?? "",
        },
      },
    });

    return c.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.log(`Error creating Stripe checkout: ${error}`);
    return c.json({ error: "Failed to start checkout" }, 500);
  }
});

// Create Stripe customer portal session
app.post("/billing/portal", async (c) => {
  const user = await getAuthUser(c.req.header("Authorization") ?? null);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const profile = await kv.get(`user:${user.id}`);
    if (!profile?.stripeCustomerId) {
      return c.json({ error: "No active Stripe customer found" }, 404);
    }

    const returnUrl = Deno.env.get("STRIPE_PORTAL_RETURN_URL") ?? `${getSiteUrl(c)}/dashboard`;
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: returnUrl,
    });

    return c.json({ url: session.url });
  } catch (error) {
    console.log(`Error creating billing portal session: ${error}`);
    return c.json({ error: "Failed to open billing portal" }, 500);
  }
});

// Stripe webhook handler
app.post("/billing/webhook", async (c) => {
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  if (!webhookSecret) {
    return c.json({ error: "Stripe webhook secret not configured" }, 500);
  }

  const signature = c.req.header("Stripe-Signature") ?? "";
  const payload = await c.req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.log(`Stripe webhook signature error: ${error}`);
    return c.json({ error: "Invalid signature" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;
        if (!userId) {
          break;
        }

        await updateProfileSubscription(userId, {
          subscription: "pro",
          subscriptionDate: new Date().toISOString(),
          subscriptionSource: "stripe",
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          stripeStatus: "active",
          stripePriceId: Deno.env.get("STRIPE_PRICE_ID") ?? null,
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (!userId) {
          break;
        }

        const status = subscription.status;
        const isPro = status === "active" || status === "trialing";
        await updateProfileSubscription(userId, {
          subscription: isPro ? "pro" : "free",
          subscriptionDate: isPro ? new Date().toISOString() : null,
          subscriptionSource: isPro ? "stripe" : "free",
          stripeCustomerId: subscription.customer,
          stripeSubscriptionId: subscription.id,
          stripeStatus: status,
          stripePriceId: subscription.items.data[0]?.price?.id ?? null,
          stripeCurrentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
        });
        break;
      }
      default:
        break;
    }

    return c.json({ received: true });
  } catch (error) {
    console.log(`Stripe webhook processing error: ${error}`);
    return c.json({ error: "Failed to process webhook" }, 500);
  }
});

// Create group/event
app.post("/groups", async (c) => {
  const user = await getAuthUser(c.req.header('Authorization') ?? null);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { name, description, fields, maxParticipants, groupCount, groupSize, nameField } = await c.req.json();
    
    if (!name) {
      return c.json({ error: "Group name is required" }, 400);
    }

    const parsedGroupCount = Number.parseInt(groupCount, 10);
    const parsedGroupSize = Number.parseInt(groupSize, 10);
    if (!Number.isFinite(parsedGroupCount) || parsedGroupCount < 2) {
      return c.json({ error: "Group count must be at least 2" }, 400);
    }
    if (!Number.isFinite(parsedGroupSize) || parsedGroupSize < 2) {
      return c.json({ error: "Group size must be at least 2" }, 400);
    }

    // Check user subscription and group limits
    const profile = await kv.get(`user:${user.id}`) || { subscription: 'free' };
    const userGroups = await kv.getByPrefix(`group:${user.id}:`);

    const effectiveSubscription = isAdminPro(user.email) ? 'pro' : (profile.subscription || 'free');
    if (effectiveSubscription === 'free' && userGroups.length >= 3) {
      return c.json({ error: "Free tier limited to 3 groups. Upgrade to Pro for unlimited groups." }, 403);
    }

    const groupId = crypto.randomUUID();
    const slug = await ensureUniqueUserSlug(user.id, name);
    const normalizedFields = Array.isArray(fields) && fields.length > 0
      ? fields.map((field: any, index: number) => ({
        key: field.key || field.name || `field_${index + 1}`,
        label: field.label || field.name || `Field ${index + 1}`,
        type: field.type || 'text',
        required: !!field.required
      }))
      : [
        { key: 'name', label: 'Participant Name', type: 'text', required: true }
      ];
    const resolvedNameField = typeof nameField === 'string' && nameField.length > 0
      ? nameField
      : normalizedFields[0]?.key || 'name';
    const totalSeats = parsedGroupCount * parsedGroupSize;
    const group = {
      id: groupId,
      userId: user.id,
      name,
      slug,
      description: description || '',
      fields: normalizedFields,
      nameField: resolvedNameField,
      subscription: effectiveSubscription,
      branding: effectiveSubscription !== 'pro',
      groupCount: parsedGroupCount,
      groupSize: parsedGroupSize,
      maxParticipants: maxParticipants || totalSeats,
      createdAt: new Date().toISOString(),
      participantCount: 0
    };

    await kv.set(`group:${user.id}:${groupId}`, group);
    
    return c.json({ group });
  } catch (error) {
    console.log(`Error creating group: ${error}`);
    return c.json({ error: "Failed to create group" }, 500);
  }
});

// Create public group (no auth)
app.post("/groups/public", async (c) => {
  try {
    const { name, description, fields, maxParticipants, groupCount, groupSize, nameField } = await c.req.json();

    if (!name) {
      return c.json({ error: "Group name is required" }, 400);
    }

    const parsedGroupCount = Number.parseInt(groupCount, 10);
    const parsedGroupSize = Number.parseInt(groupSize, 10);
    if (!Number.isFinite(parsedGroupCount) || parsedGroupCount < 2) {
      return c.json({ error: "Group count must be at least 2" }, 400);
    }
    if (!Number.isFinite(parsedGroupSize) || parsedGroupSize < 2) {
      return c.json({ error: "Group size must be at least 2" }, 400);
    }

    const groupId = crypto.randomUUID();
    const slug = await ensureUniquePublicSlug(name);
    const organizerKey = crypto.randomUUID();
    const normalizedFields = Array.isArray(fields) && fields.length > 0
      ? fields.map((field: any, index: number) => ({
        key: field.key || field.name || `field_${index + 1}`,
        label: field.label || field.name || `Field ${index + 1}`,
        type: field.type || 'text',
        required: !!field.required
      }))
      : [
        { key: 'name', label: 'Participant Name', type: 'text', required: true }
      ];
    const resolvedNameField = typeof nameField === 'string' && nameField.length > 0
      ? nameField
      : normalizedFields[0]?.key || 'name';
    const totalSeats = parsedGroupCount * parsedGroupSize;

    const group = {
      id: groupId,
      name,
      slug,
      description: description || '',
      fields: normalizedFields,
      nameField: resolvedNameField,
      subscription: 'free',
      branding: true,
      groupCount: parsedGroupCount,
      groupSize: parsedGroupSize,
      maxParticipants: maxParticipants || totalSeats,
      createdAt: new Date().toISOString(),
      participantCount: 0,
      ownerKey: organizerKey
    };

    await kv.set(`group:public:${groupId}`, group);

    return c.json({ group, organizerKey });
  } catch (error) {
    console.log(`Error creating public group: ${error}`);
    return c.json({ error: "Failed to create group" }, 500);
  }
});

// Get all groups for user
app.get("/groups", async (c) => {
  const user = await getAuthUser(c.req.header('Authorization') ?? null);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const groups = await kv.getByPrefix(`group:${user.id}:`);
    return c.json({ groups: groups || [] });
  } catch (error) {
    console.log(`Error fetching groups: ${error}`);
    return c.json({ error: "Failed to fetch groups" }, 500);
  }
});

// Debug resolve (admin only)
app.get("/debug/resolve/:groupId", async (c) => {
  const user = await getAuthUser(c.req.header('Authorization') ?? null);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (!isAdminPro(user.email)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const groupId = c.req.param('groupId');
  const resolved = await resolveUserGroup(user.id, groupId);
  return c.json({ userId: user.id, resolved });
});

// Get public group
app.get("/groups/public/:groupId", async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const resolved = await resolvePublicGroup(groupId);
    if (!resolved) {
      return c.json({ error: "Group not found" }, 404);
    }
    const { group } = resolved;

    return c.json({
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      fields: group.fields,
      nameField: group.nameField || (group.fields?.[0]?.key ?? 'name'),
      subscription: group.subscription || 'free',
      branding: typeof group.branding === 'boolean' ? group.branding : group.subscription !== 'pro',
      groupCount: group.groupCount || 2,
      groupSize: group.groupSize || 4,
      maxParticipants: group.maxParticipants,
      participantCount: group.participantCount
    });
  } catch (error) {
    console.log(`Error fetching public group: ${error}`);
    return c.json({ error: "Failed to fetch group" }, 500);
  }
});

// Delete group
app.delete("/groups/:groupId", async (c) => {
  const user = await getAuthUser(c.req.header('Authorization') ?? null);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const groupId = c.req.param('groupId');
    const resolved = await resolveUserGroup(user.id, groupId);
    if (!resolved) {
      return c.json({ error: "Group not found" }, 404);
    }
    const { groupId: resolvedId, key: groupKey } = resolved;
    
    // Delete group and all participants
    await kv.del(groupKey);
    const participants = await kv.getByPrefix(`participant:${resolvedId}:`);
    
    for (const participant of participants) {
      await kv.del(`participant:${resolvedId}:${participant.id}`);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting group: ${error}`);
    return c.json({ error: "Failed to delete group" }, 500);
  }
});

// Delete public group (organizer key)
app.delete("/groups/public/:groupId", async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const organizerKey = c.req.header('X-Organizer-Key') ?? '';

    const resolved = await resolvePublicGroup(groupId);
    if (!resolved) {
      return c.json({ error: "Group not found" }, 404);
    }
    const { group, groupId: resolvedId, key: groupKey } = resolved;

    if (!organizerKey || organizerKey !== group.ownerKey) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await kv.del(groupKey);
    const participants = await kv.getByPrefix(`participant:${resolvedId}:`);
    for (const participant of participants) {
      await kv.del(`participant:${resolvedId}:${participant.id}`);
    }

    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting public group: ${error}`);
    return c.json({ error: "Failed to delete group" }, 500);
  }
});

// Add participant to group
app.post("/groups/:userId/:groupId/participants", async (c) => {
  try {
    const userId = c.req.param('userId');
    const groupId = c.req.param('groupId');
    const formData = await c.req.json();
    
    const resolved = await resolveUserGroup(userId, groupId);
    if (!resolved) {
      return c.json({ error: "Group not found" }, 404);
    }
    const { group, groupId: resolvedId, key: groupKey } = resolved;

    const existingParticipants = await kv.getByPrefix(`participant:${resolvedId}:`);
    const currentCount = existingParticipants.length;

    // Check max participants
    if (group.maxParticipants && currentCount >= group.maxParticipants) {
      return c.json({ error: "Group is full" }, 400);
    }

    const groupCount = group.groupCount || 2;
    const groupSize = group.groupSize || 4;
    const counts = Array.from({ length: groupCount }, () => 0);
    existingParticipants.forEach((participant: any) => {
      if (participant.assignedGroup && participant.assignedGroup <= groupCount) {
        counts[participant.assignedGroup - 1] += 1;
      }
    });

    const available = counts
      .map((count, index) => ({ count, index }))
      .filter(entry => entry.count < groupSize);

    if (available.length === 0) {
      return c.json({ error: "Group is full" }, 400);
    }

    const minCount = Math.min(...available.map(entry => entry.count));
    const candidates = available.filter(entry => entry.count === minCount);
    const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % candidates.length;
    const assignedGroup = candidates[randomIndex].index + 1;

    const nameField = group.nameField || group.fields?.[0]?.key || 'name';
    const displayName =
      formData?.[nameField] ||
      formData?.name ||
      formData?.fullName ||
      formData?.['Full Name'] ||
      'Participant';

    const participantId = crypto.randomUUID();
    const participant = {
      id: participantId,
      groupId: resolvedId,
      data: formData,
      displayName,
      assignedGroup,
      joinedAt: new Date().toISOString()
    };

    await kv.set(`participant:${resolvedId}:${participantId}`, participant);
    
    // Update participant count
    group.participantCount = currentCount + 1;
    await kv.set(groupKey, group);
    
    return c.json({ success: true, participant });
  } catch (error) {
    console.log(`Error adding participant: ${error}`);
    return c.json({ error: "Failed to add participant" }, 500);
  }
});

// Add participant to public group
app.post("/groups/public/:groupId/participants", async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const formData = await c.req.json();

    const resolved = await resolvePublicGroup(groupId);
    if (!resolved) {
      return c.json({ error: "Group not found" }, 404);
    }
    const { group, groupId: resolvedId, key: groupKey } = resolved;

    const existingParticipants = await kv.getByPrefix(`participant:${resolvedId}:`);
    const currentCount = existingParticipants.length;

    if (group.maxParticipants && currentCount >= group.maxParticipants) {
      return c.json({ error: "Group is full" }, 400);
    }

    const groupCount = group.groupCount || 2;
    const groupSize = group.groupSize || 4;
    const counts = Array.from({ length: groupCount }, () => 0);
    existingParticipants.forEach((participant: any) => {
      if (participant.assignedGroup && participant.assignedGroup <= groupCount) {
        counts[participant.assignedGroup - 1] += 1;
      }
    });

    const available = counts
      .map((count, index) => ({ count, index }))
      .filter(entry => entry.count < groupSize);

    if (available.length === 0) {
      return c.json({ error: "Group is full" }, 400);
    }

    const minCount = Math.min(...available.map(entry => entry.count));
    const candidates = available.filter(entry => entry.count === minCount);
    const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % candidates.length;
    const assignedGroup = candidates[randomIndex].index + 1;

    const nameField = group.nameField || group.fields?.[0]?.key || 'name';
    const displayName =
      formData?.[nameField] ||
      formData?.name ||
      formData?.fullName ||
      formData?.['Full Name'] ||
      'Participant';

    const participantId = crypto.randomUUID();
    const participant = {
      id: participantId,
      groupId: resolvedId,
      data: formData,
      displayName,
      assignedGroup,
      joinedAt: new Date().toISOString()
    };

    await kv.set(`participant:${resolvedId}:${participantId}`, participant);

    group.participantCount = currentCount + 1;
    await kv.set(groupKey, group);

    return c.json({ success: true, participant });
  } catch (error) {
    console.log(`Error adding public participant: ${error}`);
    return c.json({ error: "Failed to add participant" }, 500);
  }
});

// Get participants for a group
app.get("/groups/:groupId/participants", async (c) => {
  const user = await getAuthUser(c.req.header('Authorization') ?? null);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const groupId = c.req.param('groupId');
    const resolved = await resolveUserGroup(user.id, groupId);
    if (!resolved) {
      return c.json({ error: "Group not found" }, 404);
    }

    const participants = await kv.getByPrefix(`participant:${resolved.groupId}:`);
    return c.json({ participants: participants || [] });
  } catch (error) {
    console.log(`Error fetching participants: ${error}`);
    return c.json({ error: "Failed to fetch participants" }, 500);
  }
});

// Public participants list for join flow
app.get("/groups/:userId/:groupId/participants/public", async (c) => {
  try {
    const userId = c.req.param('userId');
    const groupId = c.req.param('groupId');

    const resolved = await resolveUserGroup(userId, groupId);
    if (!resolved) {
      return c.json({ error: "Group not found" }, 404);
    }
    const { group, groupId: resolvedId } = resolved;

    const participants = await kv.getByPrefix(`participant:${resolvedId}:`);
    const publicParticipants = (participants || []).map((participant: any) => ({
      id: participant.id,
      displayName: participant.displayName || participant.data?.[group.nameField] || participant.data?.name || 'Participant',
      assignedGroup: participant.assignedGroup,
      joinedAt: participant.joinedAt
    }));

    return c.json({ participants: publicParticipants });
  } catch (error) {
    console.log(`Error fetching public participants: ${error}`);
    return c.json({ error: "Failed to fetch participants" }, 500);
  }
});

// Public participants list (public view)
app.get("/groups/public/:groupId/participants/public", async (c) => {
  try {
    const groupId = c.req.param('groupId');

    const resolved = await resolvePublicGroup(groupId);
    if (!resolved) {
      return c.json({ error: "Group not found" }, 404);
    }
    const { group, groupId: resolvedId } = resolved;

    const participants = await kv.getByPrefix(`participant:${resolvedId}:`);
    const publicParticipants = (participants || []).map((participant: any) => ({
      id: participant.id,
      displayName: participant.displayName || participant.data?.[group.nameField] || participant.data?.name || 'Participant',
      assignedGroup: participant.assignedGroup,
      joinedAt: participant.joinedAt
    }));

    return c.json({ participants: publicParticipants });
  } catch (error) {
    console.log(`Error fetching public participants: ${error}`);
    return c.json({ error: "Failed to fetch participants" }, 500);
  }
});

// Organizer participants list for public group
app.get("/groups/public/:groupId/participants", async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const organizerKey = c.req.header('X-Organizer-Key') ?? '';

    const resolved = await resolvePublicGroup(groupId);
    if (!resolved) {
      return c.json({ error: "Group not found" }, 404);
    }
    const { group, groupId: resolvedId } = resolved;

    if (!organizerKey || organizerKey !== group.ownerKey) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const participants = await kv.getByPrefix(`participant:${resolvedId}:`);
    return c.json({ participants: participants || [] });
  } catch (error) {
    console.log(`Error fetching organizer participants: ${error}`);
    return c.json({ error: "Failed to fetch participants" }, 500);
  }
});

// Get single group (public - for QR code scanning)
app.get("/groups/:userId/:groupId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const groupId = c.req.param('groupId');
    
    const resolved = await resolveUserGroup(userId, groupId);
    if (!resolved) {
      return c.json({ error: "Group not found" }, 404);
    }
    const { group } = resolved;

    // Return only necessary public info
    return c.json({
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      fields: group.fields,
      nameField: group.nameField || (group.fields?.[0]?.key ?? 'name'),
      subscription: group.subscription || 'free',
      branding: typeof group.branding === 'boolean' ? group.branding : group.subscription !== 'pro',
      groupCount: group.groupCount || 2,
      groupSize: group.groupSize || 4,
      maxParticipants: group.maxParticipants,
      participantCount: group.participantCount
    });
  } catch (error) {
    console.log(`Error fetching group: ${error}`);
    return c.json({ error: "Failed to fetch group" }, 500);
  }
});

// Fallback for unknown routes to keep responses JSON and surface path for debugging.
app.all("*", (c) => {
  return c.json({ error: "Not found", path: c.req.path }, 404);
});

Deno.serve(app.fetch);
