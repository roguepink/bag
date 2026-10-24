// index.js — バッグの一覧(型紙係)
// 仲間(グループ)ごとにファイルを分けている。新しいバッグは そのファイルに足して、XXX_BAGS に入れる。
import { TOTE_BAGS } from './tote.js';
import { POUCH_BAGS } from './pouch.js';
import { WA_BAGS } from './wa.js';
import { SHOULDER_BAGS } from './shoulder.js';
import { BACKPACK_BAGS } from './backpack.js';
import { OUTING_BAGS } from './outing.js';

export const GROUPS = [
  { id: 'tote', name: 'トートバッグ', icon: '👜' },
  { id: 'shoulder', name: 'ショルダー・ななめがけ', icon: '👝' },
  { id: 'pouch', name: 'ポーチ・小物', icon: '👛' },
  { id: 'wa', name: '和の袋', icon: '🎎' },
  { id: 'backpack', name: 'リュック', icon: '🎒' },
  { id: 'outing', name: 'おでかけバッグ', icon: '🧺' },
];

// 並び順は GROUPS の順
export const BAGS = [...TOTE_BAGS, ...SHOULDER_BAGS, ...POUCH_BAGS, ...WA_BAGS, ...BACKPACK_BAGS, ...OUTING_BAGS];

export const bagById = (id) => BAGS.find((b) => b.id === id) || null;
export const bagsInGroup = (gid) => BAGS.filter((b) => b.group === gid);
