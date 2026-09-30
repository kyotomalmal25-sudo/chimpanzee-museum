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
  { key: 'Grok', slug: 'grok', label: 'Grok', mark: 'Gk', orb: ['#9AA3AD', '#3A3F46', '#141619'], menu: true },
  { key: 'GPT', slug: 'gpt', label: 'GPT', mark: 'Gp', orb: ['#8FE0C4', '#1F9A78', '#0B4F3D'], menu: true },
  { key: 'Gemini', slug: 'gemini', label: 'Gemini', mark: 'Ge', orb: ['#9FC2FF', '#5B6CF0', '#3A2E9C'], menu: true },
  { key: 'Qwen', slug: 'qwen', label: 'Qwen', mark: 'Qw', orb: ['#D6B6FF', '#8E55E8', '#4C2596'], menu: true },
  { key: 'MAI', slug: 'mai', label: 'MAI', mark: 'Ma', orb: ['#A6E4FF', '#2F9BE0', '#135A92'], menu: true },
  { key: 'Claude', slug: 'claude', label: 'Claude', mark: 'Cl', orb: ['#FFC49E', '#E0703C', '#9A3A16'], menu: true },
  { key: 'Kimi', slug: 'kimi', label: 'Kimi', mark: 'Ki', orb: ['#E4E4E4', '#9A9A9A', '#555555'] },
  { key: 'Other', slug: 'other', label: 'その他', mark: '+', orb: ['#F2E3C4', '#C9A566', '#80602A'] },
  { key: 'Unknown', slug: 'unknown', label: '未分類', mark: '?', orb: ['#EDEBE4', '#BDBBB0', '#8A887E'] },
];
export const DEFAULT_AI = 'Grok';
// orb: [highlight, body, rim] colours of the glossy sphere shown in the menu (original, not vendor logos).

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
