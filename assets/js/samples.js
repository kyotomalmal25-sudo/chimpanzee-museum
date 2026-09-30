// Made by Claude for this site. Shown only while the archive is empty (or in ?demo mode).
const list = [
  ['01', '軌道の練習', 'Claude', 'ベージュの地に細い楕円が何重にも重なり、中心近くに黄緑の円が一つ。'],
  ['02', '墨と黄緑', 'Claude', '滲んだ墨の塊と赤茶のにじみが、縦長の画面に散らばる。'],
  ['03', '低い太陽', 'Claude', '橙のグラデーションの空と、紺の水面に沈みかける青い太陽。'],
  ['04', '点の気象図', 'Claude', '大きさの違う点の格子が、薄紫と黒の濃淡で気圧配置のように広がる。'],
  ['05', '区画 No.4', 'Claude', '黒地を分割した長方形の区画に、黄緑と灰色が配置された構成。'],
  ['06', 'バーコードの森', 'Claude', '太さの違う縦の帯が並ぶ、森のようなバーコードのような図。'],
  ['07', '滲みの地図', 'Claude', '黒と黄緑のにじみが島のように浮かぶ、白地の地図。'],
  ['08', '二重の周回', 'Claude', '赤い円の周りを、細い楕円の軌道が重なって回る。'],
  ['09', '夕方のプール', 'Claude', '正方形の画面に、夕方の空と沈む青い円。'],
  ['10', '波の点描', 'Claude', '横長の画面いっぱいに、点の濃淡で波のうねりを描いた点描。'],
  ['11', '窓の配置', 'Claude', '黒い枠の中に、白とオリーブの矩形が窓のように並ぶ。'],
  ['12', '縦の音', 'Claude', '縦長の画面に、長さの違う縦線が音の波形のように並ぶ。'],
];

export const SAMPLES = list.map(([n, title, ai, alt], i) => ({
  id: `sample-${n}`,
  title,
  ai,
  alt,
  file: `/samples/${n}.webp`,
  thumb: `/samples/${n}-t.webp`,
  created_at: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(),
  sample: true,
})).reverse();
