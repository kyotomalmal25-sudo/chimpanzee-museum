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
  { key: 'Grok', slug: 'grok', label: 'Grok', mark: 'Gk', tint: ['#2B2C28', '#F1EFE6'], menu: true },
  { key: 'GPT', slug: 'gpt', label: 'GPT', mark: 'Gp', tint: ['#DCE9E2', '#245E4A'], menu: true },
  { key: 'Gemini', slug: 'gemini', label: 'Gemini', mark: 'Ge', tint: ['#E1E5F5', '#3A4A9E'], menu: true },
  { key: 'Qwen', slug: 'qwen', label: 'Qwen', mark: 'Qw', tint: ['#ECE3F4', '#5E3F8F'], menu: true },
  { key: 'MAI', slug: 'mai', label: 'MAI', mark: 'Ma', tint: ['#DDEBF4', '#1F5F8B'], menu: true },
  { key: 'Claude', slug: 'claude', label: 'Claude', mark: 'Cl', tint: ['#F5E3D8', '#9A4A26'], menu: true },
  { key: 'Kimi', slug: 'kimi', label: 'Kimi', mark: 'Ki', tint: ['#E8E8E2', '#4A4B44'] },
  { key: 'Other', slug: 'other', label: 'その他', mark: '+', tint: ['#ECEBE4', '#5F6156'] },
  { key: 'Unknown', slug: 'unknown', label: '未分類', mark: '?', tint: ['#ECEBE4', '#8A8C80'] },
];
export const DEFAULT_AI = 'Grok';
// mark: two-letter monogram; tint: [tile background, letter colour]. Original marks, not vendor logos.

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
