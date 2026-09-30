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
  { key: 'Grok', slug: 'grok', label: 'Grok', mark: 'Gk', paint: { base: '#2A2D33', dabs: [['#59616F', 13, 12, 13], ['#1A1C20', 29, 30, 14], ['#8A93A3', 24, 9, 6], ['#B8743A', 30, 20, 5]] }, menu: true },
  { key: 'GPT', slug: 'gpt', label: 'GPT', mark: 'Gp', paint: { base: '#1F8A6E', dabs: [['#9BE3C5', 12, 11, 11], ['#0E4A3B', 30, 30, 14], ['#E1D46E', 27, 13, 6], ['#3FB894', 16, 27, 9]] }, menu: true },
  { key: 'Gemini', slug: 'gemini', label: 'Gemini', mark: 'Ge', paint: { base: '#4F6FEA', dabs: [['#8E5BE8', 29, 27, 13], ['#9ED8FF', 12, 11, 10], ['#F28DB2', 28, 11, 7], ['#2E3AA8', 14, 31, 9]] }, menu: true },
  { key: 'Qwen', slug: 'qwen', label: 'Qwen', mark: 'Qw', paint: { base: '#7444D2', dabs: [['#C85BC7', 28, 13, 11], ['#35248C', 16, 30, 13], ['#E7B4F0', 12, 11, 7], ['#5C7BF0', 31, 29, 7]] }, menu: true },
  { key: 'MAI', slug: 'mai', label: 'MAI', mark: 'Ma', paint: { base: '#2E9BE0', dabs: [['#6FE3D4', 13, 13, 11], ['#1B4C88', 29, 30, 13], ['#F2F7FF', 26, 10, 5], ['#57C1F2', 30, 17, 8]] }, menu: true },
  { key: 'Claude', slug: 'claude', label: 'Claude', mark: 'Cl', paint: { base: '#D8683A', dabs: [['#F4AE62', 13, 12, 11], ['#9C3521', 29, 30, 13], ['#C9505E', 30, 15, 7], ['#F7DFC0', 22, 8, 4]] }, menu: true },
  { key: 'Kimi', slug: 'kimi', label: 'Kimi', mark: 'Ki', paint: { base: '#8E8E8A', dabs: [['#D5D5CF', 13, 12, 10], ['#4E4E4A', 29, 30, 12]] } },
  { key: 'Other', slug: 'other', label: 'その他', mark: '+', paint: { base: '#BF9C5E', dabs: [['#F0DDB2', 13, 12, 10], ['#7B5A26', 29, 30, 12]] } },
  { key: 'Unknown', slug: 'unknown', label: '未分類', mark: '?', paint: { base: '#B9B7AC', dabs: [['#EEECE4', 13, 12, 10], ['#86847A', 29, 30, 12]] } },
];
export const DEFAULT_AI = 'Grok';
// paint: base colour + dabs [colour, cx, cy, r] (40x40) blended into a glossy, oil-paint sphere in the menu.
// Original marks, not vendor logos.

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
