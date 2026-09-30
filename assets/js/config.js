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
};

// key = value stored in the database `ai` column (unchanged from the old site)
export const AIS = [
  { key: 'GPT', slug: 'gpt', label: 'GPT', mark: 'G' },
  { key: 'Claude', slug: 'claude', label: 'Claude', mark: 'C' },
  { key: 'Gemini', slug: 'gemini', label: 'Gemini', mark: 'Ge' },
  { key: 'Qwen', slug: 'qwen', label: 'Qwen', mark: 'Q' },
  { key: 'Kimi', slug: 'kimi', label: 'Kimi', mark: 'K' },
  { key: 'Other', slug: 'other', label: 'その他', mark: '+' },
  { key: 'Unknown', slug: 'unknown', label: '未分類', mark: '·' },
];

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
