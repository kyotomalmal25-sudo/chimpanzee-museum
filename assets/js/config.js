// Public configuration. Never put a service_role / secret key here.
export const SITE = {
  name: 'Chimpanzee Museum',
  tagline: 'A little out of the ordinary.',
  footer: 'BANANAS NEED NO REASON.',
};

export const SUPABASE = {
  url: 'https://srngtuzkpndxvhlngrpr.supabase.co',
  publishableKey: 'sb_publishable_dGlJm9WviigWZmjODQ5jbQ_CxQR9Hsy',
  table: 'museum_works',
  admins: 'museum_admins',
  bucket: 'museum-images',
  // Older rows store relative paths like `images/1.jpg`, served by the old GitHub Pages site.
  legacyBase: 'https://kyotomalmal25-sudo.github.io/chimpanzee-museum/',
};

// key = value stored in the database `ai` column.
// menu: the categories shown in the menu and offered when posting (always, even with 0 works).
// The rest stay readable for older rows and appear in the menu only while they have works.
export const AIS = [
  { key: 'Grok', slug: 'grok', label: 'Grok', mark: 'Gk', menu: true },
  { key: 'GPT', slug: 'gpt', label: 'GPT', mark: 'G', menu: true },
  { key: 'Gemini', slug: 'gemini', label: 'Gemini', mark: 'Ge', menu: true },
  { key: 'Qwen', slug: 'qwen', label: 'Qwen', mark: 'Q', menu: true },
  { key: 'MAI', slug: 'mai', label: 'MAI', mark: 'M', menu: true },
  { key: 'Claude', slug: 'claude', label: 'Claude', mark: 'C', menu: true },
  { key: 'Kimi', slug: 'kimi', label: 'Kimi', mark: 'K' },
  { key: 'Other', slug: 'other', label: 'その他', mark: '+' },
  { key: 'Unknown', slug: 'unknown', label: '未分類', mark: '·' },
];
export const DEFAULT_AI = 'Grok';

export const aiByKey = key => AIS.find(a => a.key === key) || AIS[AIS.length - 1];
export const aiBySlug = slug => AIS.find(a => a.slug === slug) || null;
export const aiLabel = key => aiByKey(key).label;

export const UPLOAD = {
  maxInputBytes: 40 * 1024 * 1024, // before client-side resize
  fullMaxEdge: 2400,
  fullQuality: 0.88,
  thumbMaxEdge: 720,
  thumbQuality: 0.8,
};
