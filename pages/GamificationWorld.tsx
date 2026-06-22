import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppState, WorkContext } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const GRID_W = 52;
const GRID_H = 38;
const TILE_W = 64;
const TILE_H = 32;
const SPEED = 0.011; // slow wandering

// ── Helpers ───────────────────────────────────────────────────────────────────
function g2s(gx: number, gy: number) {
  return {
    sx: (gx - gy) * (TILE_W / 2),
    sy: (gx + gy) * (TILE_H / 2),
  };
}

// ── Color helpers ─────────────────────────────────────────────────────────────
function darkenHex(hex: string, f = 0.7): string {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  return `rgb(${Math.floor(parseInt(m[1],16)*f)},${Math.floor(parseInt(m[2],16)*f)},${Math.floor(parseInt(m[3],16)*f)})`;
}
function lightenHex(hex: string, f = 0.3): string {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1],16), g = parseInt(m[2],16), b = parseInt(m[3],16);
  return `rgb(${Math.min(255,r+Math.floor((255-r)*f))},${Math.min(255,g+Math.floor((255-g)*f))},${Math.min(255,b+Math.floor((255-b)*f))})`;
}

// ── Terrain System ────────────────────────────────────────────────────────────
function hash2d(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2d(ix, iy), b = hash2d(ix + 1, iy);
  const c = hash2d(ix, iy + 1), d = hash2d(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function terrainHeight(gx: number, gy: number): number {
  return smoothNoise(gx * 0.07, gy * 0.07) * 0.5 +
         smoothNoise(gx * 0.14 + 50, gy * 0.14 + 50) * 0.3 +
         smoothNoise(gx * 0.28 + 100, gy * 0.28 + 100) * 0.2;
}

interface BiomeColors { top: string; left: string; right: string; stroke: string; }

const BLOCK_H = 32;

function getBiome(h: number, gx: number, gy: number): BiomeColors {
  if (h < 0.22) {
    // Water
    return { top: '#2ba5d1', left: '#1c7394', right: '#258cb3', stroke: 'rgba(28,115,148,0.3)' };
  }
  if (h < 0.28) {
    // Sand / Shore
    return { top: '#ecd699', left: '#cbb376', right: '#dfc585', stroke: 'rgba(203,179,118,0.25)' };
  }
  if (h < 0.48) {
    // Grass Tier 1
    const alt = (gx + gy) % 2 === 0;
    return {
      top: alt ? '#85be3b' : '#7cab30',
      left: '#78522e',
      right: '#96683c',
      stroke: 'rgba(90,130,40,0.12)',
    };
  }
  if (h < 0.65) {
    // Grass Tier 2 (Hills)
    return {
      top: '#75a932',
      left: '#6b4625',
      right: '#885b32',
      stroke: 'rgba(80,115,35,0.15)',
    };
  }
  if (h < 0.78) {
    // Path / Dirt
    return {
      top: '#d6993a',
      left: '#9b6c22',
      right: '#b8822f',
      stroke: 'rgba(155,108,34,0.18)',
    };
  }
  // Mountain Peak
  return {
    top: '#e9e2d3',
    left: '#8a7b6e',
    right: '#a8998b',
    stroke: 'rgba(138,123,110,0.2)',
  };
}

function getElevation(h: number): number {
  if (h < 0.22) return 0;
  if (h < 0.28) return 0;
  if (h < 0.48) return BLOCK_H;
  if (h < 0.65) return BLOCK_H * 2;
  if (h < 0.78) return BLOCK_H * 3;
  return BLOCK_H * 4;
}

function getCharElevation(x: number, y: number, td: { elev: number }[][]): number {
  const gx = Math.min(GRID_W - 1, Math.max(0, Math.round(x)));
  const gy = Math.min(GRID_H - 1, Math.max(0, Math.round(y)));
  return td[gy]?.[gx]?.elev || 0;
}

// ── Palettes ──────────────────────────────────────────────────────────────────
const PALETTES = [
  { body: '#6366f1', bodyDk: '#3730a3', pants: '#1e1b4b', pantsDk: '#0f0e27', shoe: '#312e81', hair: '#1e1b4b', skin: '#fcd5b5', skinDk: '#e8b99a' },
  { body: '#22c55e', bodyDk: '#15803d', pants: '#052e16', pantsDk: '#021a0d', shoe: '#166534', hair: '#052e16', skin: '#fcd5b5', skinDk: '#e8b99a' },
  { body: '#ec4899', bodyDk: '#be185d', pants: '#500724', pantsDk: '#2d0314', shoe: '#9d174d', hair: '#500724', skin: '#fcd5b5', skinDk: '#e8b99a' },
  { body: '#f97316', bodyDk: '#c2410c', pants: '#431407', pantsDk: '#280c04', shoe: '#9a3412', hair: '#431407', skin: '#fcd5b5', skinDk: '#e8b99a' },
  { body: '#3b82f6', bodyDk: '#1d4ed8', pants: '#1e3a8a', pantsDk: '#0f1d4e', shoe: '#1e40af', hair: '#1e3a8a', skin: '#fcd5b5', skinDk: '#e8b99a' },
  { body: '#a855f7', bodyDk: '#7e22ce', pants: '#3b0764', pantsDk: '#1e0334', shoe: '#6b21a8', hair: '#3b0764', skin: '#fcd5b5', skinDk: '#e8b99a' },
  { body: '#14b8a6', bodyDk: '#0f766e', pants: '#042f2e', pantsDk: '#021918', shoe: '#134e4a', hair: '#042f2e', skin: '#fcd5b5', skinDk: '#e8b99a' },
  { body: '#eab308', bodyDk: '#a16207', pants: '#422006', pantsDk: '#200e03', shoe: '#713f12', hair: '#422006', skin: '#fcd5b5', skinDk: '#e8b99a' },
  { body: '#ef4444', bodyDk: '#b91c1c', pants: '#450a0a', pantsDk: '#250505', shoe: '#991b1b', hair: '#450a0a', skin: '#fcd5b5', skinDk: '#e8b99a' },
  { body: '#06b6d4', bodyDk: '#0e7490', pants: '#082f49', pantsDk: '#041525', shoe: '#0c4a6e', hair: '#082f49', skin: '#fcd5b5', skinDk: '#e8b99a' },
];

// Armor body colors per tier (overrides palette body)
const ARMOR_BODY = ['', '#92400e', '#374151', '#1f2937', '#1e1b4b'];
const ARMOR_DARK = ['', '#78350f', '#1f2937', '#111827', '#0f0e27'];
const ARMOR_HI   = ['', '#b45309', '#6b7280', '#9ca3af', '#818cf8'];

// ── Equipment tier helpers ─────────────────────────────────────────────────────
function weaponTier(artworks: number, projects: number) {
  const s = artworks + projects * 8;
  if (s === 0) return 0;
  if (s <= 30) return 1;
  if (s <= 120) return 2;
  if (s <= 400) return 3;
  return 4;
}
function shieldTier(artworks: number, leads: number) {
  const s = artworks + leads * 8;
  if (s === 0) return 0;
  if (s <= 20) return 1;
  if (s <= 80) return 2;
  if (s <= 250) return 3;
  return 4;
}
function armorTier(artworks: number) {
  if (artworks === 0) return 0;
  if (artworks <= 25) return 1;
  if (artworks <= 100) return 2;
  if (artworks <= 300) return 3;
  return 4;
}
function crownTier(rating: number | null) {
  if (rating === null) return 0;
  if (rating < 2.0) return 1;
  if (rating < 3.5) return 2;
  if (rating < 4.5) return 3;
  return 4;
}

// ── Crown SVG ─────────────────────────────────────────────────────────────────
const Crown: React.FC<{ tier: number; float: number }> = ({ tier, float }) => {
  if (tier === 0) return null;
  const y = -72 + float;
  return (
    <g transform={`translate(0, ${y})`}>
      {tier === 1 && (
        <g>
          <rect x={-10} y={0} width={20} height={6} fill="#fbbf24" />
          <rect x={-10} y={0} width={20} height={2} fill="#fde68a" />
          <rect x={-10} y={-6} width={6} height={6} fill="#fbbf24" />
          <rect x={-2} y={-9} width={4} height={9} fill="#fbbf24" />
          <rect x={4} y={-6} width={6} height={6} fill="#fbbf24" />
          <rect x={-10} y={4} width={20} height={2} fill="#92400e" />
        </g>
      )}
      {tier === 2 && (
        <g>
          <rect x={-12} y={0} width={24} height={7} fill="#f59e0b" />
          <rect x={-12} y={0} width={24} height={2} fill="#fde68a" />
          <rect x={-12} y={-7} width={7} height={7} fill="#f59e0b" />
          <rect x={-2} y={-11} width={4} height={11} fill="#f59e0b" />
          <rect x={5} y={-7} width={7} height={7} fill="#f59e0b" />
          <rect x={-2} y={-10} width={4} height={4} fill="#ef4444" />
          <rect x={-1} y={-10} width={2} height={2} fill="rgba(255,255,255,0.6)" />
          <rect x={-12} y={5} width={24} height={2} fill="#78350f" />
        </g>
      )}
      {tier === 3 && (
        <g>
          <rect x={-14} y={0} width={28} height={8} fill="#d97706" />
          <rect x={-14} y={0} width={28} height={2} fill="#fde68a" />
          <rect x={-14} y={-8} width={8} height={8} fill="#d97706" />
          <rect x={-5} y={-14} width={5} height={14} fill="#d97706" />
          <rect x={0} y={-16} width={4} height={16} fill="#f59e0b" />
          <rect x={4} y={-14} width={5} height={14} fill="#d97706" />
          <rect x={6} y={-8} width={8} height={8} fill="#d97706" />
          <rect x={-1} y={-14} width={6} height={6} fill="#a855f7" />
          <rect x={0} y={-14} width={3} height={3} fill="rgba(255,255,255,0.7)" />
          <rect x={-13} y={-6} width={4} height={4} fill="#3b82f6" />
          <rect x={9} y={-6} width={4} height={4} fill="#3b82f6" />
          <rect x={-14} y={6} width={28} height={2} fill="#78350f" />
        </g>
      )}
      {tier === 4 && (
        <g>
          <rect x={-18} y={-20} width={36} height={28} fill="rgba(251,191,36,0.1)" />
          <rect x={-16} y={0} width={32} height={9} fill="#b45309" />
          <rect x={-16} y={0} width={32} height={2} fill="#fde68a" />
          <rect x={-16} y={-10} width={9} height={10} fill="#b45309" />
          <rect x={-7} y={-17} width={6} height={17} fill="#d97706" />
          <rect x={-3} y={-20} width={6} height={20} fill="#f59e0b" />
          <rect x={1} y={-17} width={6} height={17} fill="#d97706" />
          <rect x={7} y={-10} width={9} height={10} fill="#b45309" />
          <rect x={-2} y={-18} width={4} height={4} fill="#ec4899" />
          <rect x={-1} y={-18} width={2} height={2} fill="rgba(255,255,255,0.8)" />
          <rect x={-6} y={-13} width={4} height={4} fill="#8b5cf6" />
          <rect x={2} y={-13} width={4} height={4} fill="#3b82f6" />
          <rect x={-15} y={-7} width={4} height={4} fill="#10b981" />
          <rect x={11} y={-7} width={4} height={4} fill="#f97316" />
          <rect x={-16} y={7} width={32} height={2} fill="#78350f" />
        </g>
      )}
    </g>
  );
};

// ── Weapon SVG (right side) ───────────────────────────────────────────────────
const Weapon: React.FC<{ tier: number; handY: number }> = ({ tier, handY }) => {
  if (tier === 0) return null;
  return (
    <g transform={`translate(22, ${handY})`}>
      {tier === 1 && (
        <g>
          <rect x={0} y={-48} width={4} height={54} fill="#92400e" />
          <rect x={1} y={-48} width={2} height={54} fill="#a16207" />
          <rect x={-2} y={-48} width={8} height={4} fill="#78350f" />
        </g>
      )}
      {tier === 2 && (
        <g>
          <rect x={0} y={-36} width={4} height={42} fill="#6b7280" />
          <rect x={1} y={-36} width={2} height={42} fill="#9ca3af" />
          <rect x={-5} y={4} width={14} height={4} fill="#374151" />
          <rect x={0} y={-36} width={4} height={6} fill="#1f2937" />
          <rect x={1} y={-36} width={2} height={2} fill="#9ca3af" />
        </g>
      )}
      {tier === 3 && (
        <g>
          <rect x={-1} y={-46} width={6} height={52} fill="#d1d5db" />
          <rect x={-1} y={-46} width={2} height={52} fill="#e5e7eb" />
          <rect x={1} y={-46} width={2} height={52} fill="#9ca3af" />
          <rect x={-7} y={4} width={18} height={5} fill="#f59e0b" />
          <rect x={-7} y={5} width={18} height={2} fill="#fbbf24" />
          <rect x={0} y={-46} width={4} height={8} fill="#1f2937" />
          <rect x={-1} y={-20} width={6} height={2} fill="#9ca3af" />
        </g>
      )}
      {tier === 4 && (
        <g>
          <rect x={-14} y={-52} width={28} height={22} fill="rgba(139,92,246,0.2)" />
          <rect x={-16} y={-52} width={20} height={22} fill="#5b21b6" />
          <rect x={-16} y={-52} width={4} height={22} fill="#4c1d95" />
          <rect x={4} y={-52} width={4} height={22} fill="#7c3aed" />
          <rect x={-16} y={-52} width={20} height={3} fill="#a78bfa" />
          <rect x={-16} y={-32} width={20} height={3} fill="#a78bfa" />
          <rect x={0} y={-30} width={4} height={36} fill="#92400e" />
          <rect x={1} y={-30} width={2} height={36} fill="#a16207" />
          <rect x={-6} y={-44} width={8} height={8} fill="#ec4899" />
          <rect x={-5} y={-44} width={4} height={4} fill="rgba(255,255,255,0.6)" />
          <rect x={-17} y={-53} width={22} height={1} fill="#a78bfa" />
        </g>
      )}
    </g>
  );
};

// ── Shield SVG (left side) ────────────────────────────────────────────────────
const Shield: React.FC<{ tier: number; handY: number }> = ({ tier, handY }) => {
  if (tier === 0) return null;
  return (
    <g transform={`translate(-28, ${handY})`}>
      {tier === 1 && (
        <g>
          <rect x={-4} y={-14} width={14} height={14} fill="#92400e" />
          <rect x={-4} y={-14} width={14} height={3} fill="#a16207" />
          <rect x={-4} y={-14} width={3} height={14} fill="#78350f" />
          <rect x={2} y={-10} width={4} height={4} fill="#fbbf24" />
        </g>
      )}
      {tier === 2 && (
        <g>
          <rect x={-6} y={-22} width={18} height={18} fill="#1e3a8a" />
          <rect x={-2} y={-4} width={10} height={8} fill="#1e3a8a" />
          <rect x={2} y={4} width={2} height={4} fill="#1e3a8a" />
          <rect x={-6} y={-22} width={18} height={3} fill="#2563eb" />
          <rect x={-6} y={-22} width={3} height={22} fill="#1e40af" />
          <rect x={0} y={-14} width={6} height={3} fill="#fbbf24" />
          <rect x={2} y={-16} width={2} height={7} fill="#fbbf24" />
        </g>
      )}
      {tier === 3 && (
        <g>
          <rect x={-8} y={-26} width={22} height={18} fill="#374151" />
          <rect x={-8} y={-8} width={11} height={10} fill="#374151" />
          <rect x={3} y={-8} width={11} height={6} fill="#374151" />
          <rect x={1} y={-2} width={4} height={4} fill="#374151" />
          <rect x={-8} y={-26} width={22} height={3} fill="#9ca3af" />
          <rect x={-8} y={-26} width={3} height={28} fill="#1f2937" />
          <rect x={-5} y={-19} width={16} height={3} fill="#fbbf24" />
          <rect x={1} y={-26} width={4} height={26} fill="#fbbf24" opacity={0.5} />
        </g>
      )}
      {tier === 4 && (
        <g>
          <rect x={-12} y={-34} width={28} height={44} fill="rgba(16,185,129,0.15)" />
          <rect x={-10} y={-32} width={24} height={20} fill="#065f46" />
          <rect x={-10} y={-12} width={12} height={14} fill="#065f46" />
          <rect x={2} y={-12} width={12} height={10} fill="#065f46" />
          <rect x={1} y={-2} width={6} height={6} fill="#065f46" />
          <rect x={-10} y={-32} width={24} height={3} fill="#34d399" />
          <rect x={-10} y={-32} width={3} height={38} fill="#047857" />
          <rect x={-7} y={-26} width={18} height={2} fill="#34d399" />
          <rect x={-7} y={-16} width={18} height={2} fill="#34d399" />
          <rect x={-2} y={-32} width={4} height={32} fill="#34d399" opacity={0.4} />
          <rect x={-2} y={-22} width={6} height={6} fill="#6ee7b7" />
          <rect x={-1} y={-22} width={3} height={3} fill="rgba(255,255,255,0.7)" />
        </g>
      )}
    </g>
  );
};

// ── Isometric Box Helper ──────────────────────────────────────────────────────
// Renders an isometric box (prism) with bottom-center at (x, y)
// w = half-width, d = half-depth (iso), h = height upward
const IB: React.FC<{
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  ct: string;
  cl: string;
  cr: string;
  stroke?: string;
  strokeWidth?: number;
}> = ({ x, y, w, d, h, ct, cl, cr, stroke, strokeWidth }) => (
  <g>
    {h > 0 && (
      <>
        <polygon
          points={`${x - w},${y - h} ${x},${y - h + d} ${x},${y + d} ${x - w},${y}`}
          fill={cl}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
        <polygon
          points={`${x},${y - h + d} ${x + w},${y - h} ${x + w},${y} ${x},${y + d}`}
          fill={cr}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      </>
    )}
    <polygon
      points={`${x},${y - h - d} ${x + w},${y - h} ${x},${y - h + d} ${x - w},${y - h}`}
      fill={ct}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  </g>
);

// ── Pixel Art Isometric Character ─────────────────────────────────────────────
const PixelChar: React.FC<{
  pal: typeof PALETTES[0];
  wTier: number; sTier: number; aTier: number; cTier: number;
  frame: number; moving: boolean; name: string; isDragging: boolean;
}> = ({ pal, wTier, sTier, aTier, cTier, frame, moving, name, isDragging }) => {
  const leg  = moving ? Math.sin(frame * 0.22) * 3 : 0;
  const arm  = moving ? Math.sin(frame * 0.22 + Math.PI) * 3 : 0;
  const bob  = moving ? Math.abs(Math.sin(frame * 0.22)) * 1.5 : 0;
  const flt  = Math.sin(frame * 0.045) * 3;

  const bC = aTier > 0 ? ARMOR_BODY[aTier] : pal.body;
  const bD = aTier > 0 ? ARMOR_DARK[aTier] : pal.bodyDk;
  const bH = aTier > 0 ? (ARMOR_HI[aTier] || pal.body) : lightenHex(pal.body, 0.2);

  const by = -bob;

  // Key Y positions (matching original bounding box structure)
  const footY = 0;
  const legY = -5 + by;
  const bodyY = -21 + by;
  const headY = -43 + by;

  // Hand Y positions
  const handBaseY = -12 + by;
  const handRY = handBaseY - arm;
  const handLY = handBaseY + arm;

  // Derived colors
  const shoeTop = lightenHex(pal.shoe, 0.15);
  const shoeDk = darkenHex(pal.shoe, 0.6);
  const pantsTop = lightenHex(pal.pants, 0.2);
  const skinTop = lightenHex(pal.skin, 0.1);
  const hairLt = lightenHex(pal.hair, 0.2);
  const hairDk = darkenHex(pal.hair, 0.4);

  // Common outline config
  const outColor = "#111118";
  const outW = 1.0;

  return (
    <g style={{ filter: isDragging ? 'brightness(1.3) drop-shadow(0 10px 18px rgba(0,0,0,0.5))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}>
      {/* Shadow */}
      <ellipse cx={0} cy={footY + 3} rx={isDragging ? 20 : 14} ry={isDragging ? 7 : 5} fill="rgba(0,0,0,0.15)" />

      {/* ── BACK LEG (left) ── */}
      <IB x={-4} y={legY + leg} w={3} d={2} h={12} ct={pantsTop} cl={pal.pantsDk} cr={pal.pants} stroke={outColor} strokeWidth={outW} />
      {/* ── BACK SHOE (left) ── */}
      <IB x={-4.5} y={footY + leg * 0.3} w={3.5} d={2.5} h={4} ct={shoeTop} cl={shoeDk} cr={pal.shoe} stroke={outColor} strokeWidth={outW} />

      {/* ── BACK ARM (left) + Shield ── */}
      {/* Sleeve */}
      <IB x={-9} y={handLY - 8} w={2.5} d={2} h={5} ct={bH} cl={bD} cr={bC} stroke={outColor} strokeWidth={outW} />
      {/* Forearm */}
      <IB x={-9} y={handLY} w={2} d={1.6} h={8} ct={skinTop} cl={pal.skinDk} cr={pal.skin} stroke={outColor} strokeWidth={outW} />
      <Shield tier={sTier} handY={handLY} />

      {/* ── FRONT LEG (right) ── */}
      <IB x={4} y={legY - leg} w={3} d={2} h={12} ct={pantsTop} cl={pal.pantsDk} cr={pal.pants} stroke={outColor} strokeWidth={outW} />
      {/* ── FRONT SHOE (right) ── */}
      <IB x={4.5} y={footY - leg * 0.3} w={3.5} d={2.5} h={4} ct={shoeTop} cl={shoeDk} cr={pal.shoe} stroke={outColor} strokeWidth={outW} />

      {/* ── BODY ── */}
      {/* Lower waist/belt */}
      <IB x={0} y={bodyY + 5} w={7} d={4.2} h={5} ct={pantsTop} cl={pal.pantsDk} cr={pal.pants} stroke={outColor} strokeWidth={outW} />
      {/* Torso shirt */}
      <IB x={0} y={bodyY} w={7} d={4.2} h={17} ct={bH} cl={bD} cr={bC} stroke={outColor} strokeWidth={outW} />

      {/* Armor decoration stripes on right face */}
      {aTier >= 1 && (
        <polygon
          points={`0,${bodyY-6+4.2} 7,${bodyY-6} 7,${bodyY-4} 0,${bodyY-4+4.2}`}
          fill="rgba(255,255,255,0.15)"
        />
      )}
      {aTier >= 2 && (
        <polygon
          points={`0,${bodyY-12+4.2} 7,${bodyY-12} 7,${bodyY-10} 0,${bodyY-10+4.2}`}
          fill="rgba(255,255,255,0.12)"
        />
      )}
      {aTier >= 3 && (
        <polygon
          points={`0,${bodyY-3+4.2} 7,${bodyY-3} 7,${bodyY-1} 0,${bodyY-1+4.2}`}
          fill="rgba(255,255,255,0.1)"
        />
      )}

      {/* ── FRONT ARM (right) + Weapon ── */}
      {/* Sleeve */}
      <IB x={9} y={handRY - 8} w={2.5} d={2} h={5} ct={bH} cl={bD} cr={bC} stroke={outColor} strokeWidth={outW} />
      {/* Forearm */}
      <IB x={9} y={handRY} w={2} d={1.6} h={8} ct={skinTop} cl={pal.skinDk} cr={pal.skin} stroke={outColor} strokeWidth={outW} />
      <Weapon tier={wTier} handY={handRY} />

      {/* ── HEAD ── */}
      {/* Head main skin box */}
      <IB x={0} y={headY} w={6} d={5} h={10} ct={skinTop} cl={pal.skinDk} cr={pal.skin} stroke={outColor} strokeWidth={outW} />

      {/* Hair cap on top */}
      <IB x={0} y={headY - 6.5} w={6.2} d={5.2} h={4} ct={hairLt} cl={hairDk} cr={pal.hair} stroke={outColor} strokeWidth={outW} />
      {/* Hair back cover */}
      <IB x={-2.5} y={headY - 1.5} w={3.7} d={3.2} h={7} ct={hairLt} cl={hairDk} cr={pal.hair} stroke={outColor} strokeWidth={outW} />

      {/* Eye rendering math on right face of skin head block */}
      {/* Slope dx=1 => dy=-5/6 = -0.833 */}
      {/* Eye 1 */}
      <polygon
        points={`
          1.2,${headY - 5 + 3.5 - 1.0}
          2.4,${headY - 5 + 3.5 - 2.0}
          2.4,${headY - 5 + 5.5 - 2.0}
          1.2,${headY - 5 + 5.5 - 1.0}
        `}
        fill="#111118"
      />
      {/* Eye 2 */}
      <polygon
        points={`
          3.6,${headY - 5 + 3.5 - 3.0}
          4.8,${headY - 5 + 3.5 - 4.0}
          4.8,${headY - 5 + 5.5 - 4.0}
          3.6,${headY - 5 + 5.5 - 3.0}
        `}
        fill="#111118"
      />

      {/* Glasses (if name has 'e', 'a', or 'u' for variety, or just draw for stylish guys like the reference) */}
      {(name.toLowerCase().includes('e') || name.toLowerCase().includes('a')) && (
        <polygon
          points={`
            0.5,${headY - 5 + 2.8 - 0.41}
            5.5,${headY - 5 + 2.8 - 4.58}
            5.5,${headY - 5 + 4.2 - 4.58}
            0.5,${headY - 5 + 4.2 - 0.41}
          `}
          fill="#111118"
        />
      )}

      {/* Mouth on right face */}
      <line
        x1={2.2}
        y1={headY - 5 + 7.5 - 1.83}
        x2={4.2}
        y2={headY - 5 + 7.5 - 3.5}
        stroke={pal.skinDk}
        strokeWidth="1.2"
      />

      {/* ── CROWN ── */}
      <Crown tier={cTier} float={flt} />

      {/* ── NAME TAG ── */}
      <g transform={`translate(0, ${headY - 26})`}>
        <rect x={-name.length * 3.8 - 4} y={-10} width={name.length * 7.6 + 8} height={14} fill="rgba(0,0,0,0.82)" rx={2} />
        <rect x={-name.length * 3.8 - 4} y={-10} width={name.length * 7.6 + 8} height={1} fill="rgba(255,255,255,0.08)" rx={2} />
        <text textAnchor="middle" y={1} fontSize="9" fontFamily="'Courier New', Courier, monospace"
          fontWeight="700" fill="rgba(255,255,255,0.92)" letterSpacing="1">
          {name.toUpperCase()}
        </text>
      </g>
    </g>
  );
};

// ── Isometric Environment Elements ────────────────────────────────────────────
const EnvTree: React.FC<{ sx: number; sy: number; variant: number }> = ({ sx, sy, variant }) => {
  const isPine = variant % 3 === 2;
  const outColor = "#111118";
  const outW = 1.0;

  if (isPine) {
    // Conifer Pine Tree
    return (
      <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
        <ellipse cx={0} cy={2} rx={14} ry={5} fill="rgba(0,0,0,0.12)" />
        {/* Trunk */}
        <IB x={0} y={0} w={2.5} d={1.8} h={35} ct="#5c3c24" cl="#402a19" cr="#4d331e" stroke={outColor} strokeWidth={outW} />
        {/* Lower canopy */}
        <IB x={0} y={-14} w={18} d={10} h={14} ct="#226633" cl="#144020" cr="#1a4d26" stroke={outColor} strokeWidth={outW} />
        {/* Mid canopy */}
        <IB x={0} y={-25} w={13} d={7.5} h={12} ct="#2e8544" cl="#1b532a" cr="#246a39" stroke={outColor} strokeWidth={outW} />
        {/* Top canopy */}
        <IB x={0} y={-34} w={8} d={4.5} h={10} ct="#3e9c56" cl="#276a39" cr="#318146" stroke={outColor} strokeWidth={outW} />
      </g>
    );
  }

  // Fluffy Leafy Deciduous Tree
  const g = [
    { t: '#79ac39', l: '#486822', r: '#5b832b' },
    { t: '#85be3b', l: '#4e7324', r: '#62902d' },
  ][variant % 2];

  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={2} rx={18} ry={6} fill="rgba(0,0,0,0.1)" />
      {/* Curved/stylized trunk */}
      <IB x={0} y={0} w={3.5} d={2.2} h={15} ct="#5c3c24" cl="#402a19" cr="#4d331e" stroke={outColor} strokeWidth={outW} />
      <IB x={1} y={-12} w={3.2} d={2.0} h={15} ct="#5c3c24" cl="#402a19" cr="#4d331e" stroke={outColor} strokeWidth={outW} />
      {/* Fluffy rounded canopy using overlapping boxes */}
      <IB x={0} y={-24} w={18} d={11} h={15} ct={g.t} cl={g.l} cr={g.r} stroke={outColor} strokeWidth={outW} />
      <IB x={-4} y={-32} w={12} d={8} h={11} ct={lightenHex(g.t, 0.1)} cl={g.l} cr={g.r} stroke={outColor} strokeWidth={outW} />
      <IB x={4} y={-30} w={11} d={7} h={11} ct={g.t} cl={g.l} cr={g.r} stroke={outColor} strokeWidth={outW} />
    </g>
  );
};

const EnvBuilding: React.FC<{ sx: number; sy: number; variant: number }> = ({ sx, sy, variant }) => {
  const cfg = [
    { wM: '#566573', wD: '#2c3e50', rf: '#85929e', win: '#85c1e9', h: 72 },
    { wM: '#515a5a', wD: '#2e4053', rf: '#808b96', win: '#c39bd3', h: 96 },
    { wM: '#5d6d7e', wD: '#34495e', rf: '#95a5a6', win: '#76d7c4', h: 56 },
  ][variant % 3];
  const outColor = "#111118";
  const outW = 1.0;
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={4} rx={32} ry={10} fill="rgba(0,0,0,0.12)" />
      {/* Left wall */}
      <polygon points={`-32,0 0,16 0,${16 - cfg.h} -32,${-cfg.h}`} fill={cfg.wD} stroke={outColor} strokeWidth={outW} strokeLinejoin="round" />
      {/* Right wall */}
      <polygon points={`0,16 32,0 32,${-cfg.h} 0,${16 - cfg.h}`} fill={cfg.wM} stroke={outColor} strokeWidth={outW} strokeLinejoin="round" />
      {/* Windows right */}
      <rect x={8}  y={-cfg.h + 18} width={10} height={10} fill={cfg.win} opacity={0.65} stroke={outColor} strokeWidth={0.8} />
      <rect x={22} y={-cfg.h + 18} width={10} height={10} fill={cfg.win} opacity={0.65} stroke={outColor} strokeWidth={0.8} />
      <rect x={8}  y={-cfg.h + 36} width={10} height={10} fill={cfg.win} opacity={0.4}  stroke={outColor} strokeWidth={0.8} />
      <rect x={22} y={-cfg.h + 36} width={10} height={10} fill={cfg.win} opacity={0.4}  stroke={outColor} strokeWidth={0.8} />
      {/* Windows left */}
      <rect x={-28} y={-cfg.h + 18} width={10} height={10} fill={cfg.win} opacity={0.4}  stroke={outColor} strokeWidth={0.8} />
      <rect x={-14} y={-cfg.h + 18} width={10} height={10} fill={cfg.win} opacity={0.35} stroke={outColor} strokeWidth={0.8} />
      {/* Roof top face */}
      <polygon points={`-32,${-cfg.h} 0,${-cfg.h - 16} 32,${-cfg.h} 0,${-cfg.h + 16}`} fill={cfg.rf} stroke={outColor} strokeWidth={outW} strokeLinejoin="round" />
      <polygon points={`-32,${-cfg.h} 0,${-cfg.h - 16} 2,${-cfg.h - 14} -30,${-cfg.h + 2}`} fill="rgba(255,255,255,0.08)" />
    </g>
  );
};

const EnvRock: React.FC<{ sx: number; sy: number }> = ({ sx, sy }) => {
  const outColor = "#111118";
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={3} rx={18} ry={6} fill="rgba(0,0,0,0.08)" />
      <IB x={0} y={0} w={16} d={9} h={12} ct="#95a5a6" cl="#616a6b" cr="#7f8c8d" stroke={outColor} strokeWidth={1} />
      <IB x={-5} y={-6} w={8} d={5} h={8} ct="#aab7b8" cl="#707b7c" cr="#8c9a9b" stroke={outColor} strokeWidth={1} />
    </g>
  );
};

const EnvLamp: React.FC<{ sx: number; sy: number }> = ({ sx, sy }) => {
  const outColor = "#111118";
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={3} rx={6} ry={3} fill="rgba(0,0,0,0.08)" />
      {/* Pole */}
      <IB x={0} y={0} w={2} d={1.5} h={40} ct="#7f8c8d" cl="#515a5a" cr="#6c7a7b" stroke={outColor} strokeWidth={1} />
      {/* Lamp housing */}
      <IB x={0} y={-38} w={5} d={3} h={5} ct="#5d6d7e" cl="#2c3e50" cr="#4a6274" stroke={outColor} strokeWidth={1} />
      {/* Warm glow */}
      <ellipse cx={0} cy={-43} rx={6} ry={3} fill="rgba(241,196,15,0.55)" />
      <ellipse cx={0} cy={-43} rx={4} ry={2} fill="rgba(253,230,138,0.8)" />
      <ellipse cx={0} cy={-38} rx={14} ry={9} fill="rgba(241,196,15,0.06)" />
    </g>
  );
};

const EnvBush: React.FC<{ sx: number; sy: number; variant: number }> = ({ sx, sy, variant }) => {
  const c = [
    { t: '#79ac39', l: '#486822', r: '#5b832b' },
    { t: '#85be3b', l: '#4e7324', r: '#62902d' },
  ][variant % 2];
  const outColor = "#111118";
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={2} rx={12} ry={4} fill="rgba(0,0,0,0.08)" />
      <IB x={0} y={0} w={10} d={6} h={10} ct={c.t} cl={c.l} cr={c.r} stroke={outColor} strokeWidth={1} />
      <IB x={-3} y={-6} w={6} d={4} h={6} ct={lightenHex(c.t, 0.15)} cl={c.l} cr={c.r} stroke={outColor} strokeWidth={1} />
    </g>
  );
};

const EnvFountain: React.FC<{ sx: number; sy: number }> = ({ sx, sy }) => {
  const outColor = "#111118";
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={4} rx={24} ry={8} fill="rgba(0,0,0,0.1)" />
      {/* Basin */}
      <IB x={0} y={0} w={22} d={12} h={6} ct="#7f8c8d" cl="#515a5a" cr="#6c7a7b" stroke={outColor} strokeWidth={1} />
      {/* Water surface */}
      <polygon points={`0,${-6 - 10} 20,${-6} 0,${-6 + 10} -20,${-6}`} fill="#5dade2" opacity={0.7} stroke={outColor} strokeWidth={1} />
      {/* Spire */}
      <IB x={0} y={-6} w={2} d={1.5} h={18} ct="#95a5a6" cl="#616a6b" cr="#7f8c8d" stroke={outColor} strokeWidth={1} />
      {/* Water spray */}
      <rect x={-4} y={-28} width={8} height={5} fill="#d6eaf8" opacity={0.8} />
      <rect x={-2} y={-32} width={4} height={4} fill="#ebf5fb" opacity={0.9} />
    </g>
  );
};

const EnvRuins: React.FC<{ sx: number; sy: number; variant: number }> = ({ sx, sy, variant }) => {
  const outColor = "#111118";
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={3} rx={16} ry={5} fill="rgba(0,0,0,0.08)" />
      {variant % 2 === 0 ? (
        <>
          <IB x={0} y={0} w={5} d={3} h={28} ct="#95a5a6" cl="#616a6b" cr="#7f8c8d" stroke={outColor} strokeWidth={1} />
          <rect x={-1} y={-18} width={2} height={4} fill="rgba(0,0,0,0.15)" />
        </>
      ) : (
        <>
          <IB x={-6} y={0} w={5} d={3} h={8} ct="#95a5a6" cl="#616a6b" cr="#7f8c8d" stroke={outColor} strokeWidth={1} />
          <IB x={5} y={0} w={5} d={3} h={12} ct="#aab7b8" cl="#707b7c" cr="#8c9a9b" stroke={outColor} strokeWidth={1} />
        </>
      )}
    </g>
  );
};

const EnvFlower: React.FC<{ sx: number; sy: number; variant: number }> = ({ sx, sy, variant }) => {
  const colors = ['#e74c3c', '#f39c12', '#9b59b6', '#e91e63', '#ff6f00'];
  const color = colors[variant % 5];
  const outColor = "#111118";
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      {/* Stem */}
      <rect x={-1} y={-8} width={2} height={8} fill="#27ae60" stroke={outColor} strokeWidth={0.8} />
      {/* Petals (iso diamond) */}
      <polygon points={`0,-14 3,-10 0,-6 -3,-10`} fill={color} stroke={outColor} strokeWidth={0.8} />
      {/* Center */}
      <polygon points={`0,-12 1.5,-10.5 0,-9 -1.5,-10.5`} fill="#f1c40f" />
    </g>
  );
};

// ── NEW RPG ENVIRONMENT DECORATIONS ───────────────────────────────────────────
const EnvFence: React.FC<{ sx: number; sy: number; variant: number }> = ({ sx, sy, variant }) => {
  const outColor = "#111118";
  const cL = "#5c3c24", cR = "#734a2e", cT = "#8a5a36";
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      {/* Vertical Post */}
      <IB x={0} y={0} w={3} d={2} h={16} ct={cT} cl={cL} cr={cR} stroke={outColor} strokeWidth={1} />
      
      {/* Connecting rails depending on variant */}
      {/* Variant 0: Front-Left (gy direction) */}
      {(variant % 3 === 0 || variant % 3 === 2) && (
        <g>
          {/* Top rail */}
          <polygon points="0,-12 -16,-4 -16,-1 0,-9" fill={cL} stroke={outColor} strokeWidth={1} strokeLinejoin="round" />
          {/* Bottom rail */}
          <polygon points="0,-5 -16,3 -16,6 0,-2" fill={cL} stroke={outColor} strokeWidth={1} strokeLinejoin="round" />
        </g>
      )}
      {/* Variant 1: Front-Right (gx direction) */}
      {(variant % 3 === 1 || variant % 3 === 2) && (
        <g>
          {/* Top rail */}
          <polygon points="0,-12 16,-4 16,-1 0,-9" fill={cR} stroke={outColor} strokeWidth={1} strokeLinejoin="round" />
          {/* Bottom rail */}
          <polygon points="0,-5 16,3 16,6 0,-2" fill={cR} stroke={outColor} strokeWidth={1} strokeLinejoin="round" />
        </g>
      )}
    </g>
  );
};

const EnvStump: React.FC<{ sx: number; sy: number }> = ({ sx, sy }) => {
  const outColor = "#111118";
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={2} rx={6} ry={2.5} fill="rgba(0,0,0,0.1)" />
      <IB x={0} y={0} w={5} d={3.5} h={7} ct="#e0b880" cl="#5c3c24" cr="#734a2e" stroke={outColor} strokeWidth={1} />
    </g>
  );
};

const EnvLog: React.FC<{ sx: number; sy: number; variant: number }> = ({ sx, sy, variant }) => {
  const cL = "#5c3c24", cR = "#734a2e", cT = "#e0b880";
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={2} rx={12} ry={4} fill="rgba(0,0,0,0.08)" />
      {variant % 2 === 0 ? (
        // Lying left-down to right-up
        <g>
          <polygon points="-12,4 12,-8 12,-1 0,5 -12,11" fill={cL} stroke="#111118" strokeWidth={1} />
          <polygon points="12,-8 2,-13 -10,-1 -12,4 12,-8" fill={cR} stroke="#111118" strokeWidth={1} />
          <ellipse cx={-11} cy={7} rx={3} ry={1.5} fill={cT} stroke="#111118" strokeWidth={1} />
        </g>
      ) : (
        // Lying right-down to left-up
        <g>
          <polygon points="12,4 -12,-8 -12,-1 0,5 12,11" fill={cR} stroke="#111118" strokeWidth={1} />
          <polygon points="-12,-8 -2,-13 10,-1 12,4 -12,-8" fill={cL} stroke="#111118" strokeWidth={1} />
          <ellipse cx={11} cy={7} rx={3} ry={1.5} fill={cT} stroke="#111118" strokeWidth={1} />
        </g>
      )}
    </g>
  );
};

const EnvDock: React.FC<{ sx: number; sy: number; variant: number }> = ({ sx, sy, variant }) => {
  const cL = "#5c3c24", cR = "#734a2e", cT = "#cbb291";
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      {variant % 2 === 0 ? (
        // Dock extending front-left (into water)
        <g>
          {/* Wooden support posts */}
          <IB x={-14} y={16} w={2} d={2} h={12} ct={cT} cl={cL} cr={cR} stroke="#111118" strokeWidth={1} />
          <IB x={0} y={23} w={2} d={2} h={12} ct={cT} cl={cL} cr={cR} stroke="#111118" strokeWidth={1} />
          {/* Main planks */}
          <polygon points="-18,4 12,-11 20,-7 -10,8" fill={cR} stroke="#111118" strokeWidth={1} />
          <polygon points="-14,6 16,-9 24,-5 -6,10" fill={cT} stroke="#111118" strokeWidth={1} />
          <polygon points="-10,8 20,-7 28,-3 -2,12" fill={cL} stroke="#111118" strokeWidth={1} />
        </g>
      ) : (
        // Dock extending front-right
        <g>
          {/* Wooden support posts */}
          <IB x={14} y={16} w={2} d={2} h={12} ct={cT} cl={cL} cr={cR} stroke="#111118" strokeWidth={1} />
          <IB x={0} y={23} w={2} d={2} h={12} ct={cT} cl={cL} cr={cR} stroke="#111118" strokeWidth={1} />
          {/* Main planks */}
          <polygon points="18,4 -12,-11 -20,-7 10,8" fill={cL} stroke="#111118" strokeWidth={1} />
          <polygon points="14,6 -16,-9 -24,-5 6,10" fill={cT} stroke="#111118" strokeWidth={1} />
          <polygon points="10,8 -20,-7 -28,-3 2,12" fill={cR} stroke="#111118" strokeWidth={1} />
        </g>
      )}
    </g>
  );
};

// Environment layout
const ENV_ELEMENTS: { type: string; gx: number; gy: number; v: number }[] = [
  // Deciduous Trees
  { type: 'tree',     gx: 4,  gy: 4,  v: 0 },
  { type: 'tree',     gx: 22, gy: 2,  v: 1 },
  { type: 'tree',     gx: 3,  gy: 16, v: 0 },
  { type: 'tree',     gx: 12, gy: 8,  v: 1 },
  { type: 'tree',     gx: 18, gy: 28, v: 0 },
  { type: 'tree',     gx: 47, gy: 24, v: 0 },
  { type: 'tree',     gx: 35, gy: 15, v: 1 },

  // Pine Trees (variant 2)
  { type: 'tree',     gx: 42, gy: 5,  v: 2 },
  { type: 'tree',     gx: 7,  gy: 30, v: 2 },
  { type: 'tree',     gx: 48, gy: 10, v: 2 },
  { type: 'tree',     gx: 28, gy: 32, v: 2 },
  { type: 'tree',     gx: 15, gy: 20, v: 2 },
  { type: 'tree',     gx: 38, gy: 26, v: 2 },

  // Stumps and Logs
  { type: 'stump',    gx: 5,  gy: 6,  v: 0 },
  { type: 'log',      gx: 6,  gy: 8,  v: 0 },
  { type: 'stump',    gx: 21, gy: 4,  v: 0 },
  { type: 'log',      gx: 24, gy: 3,  v: 1 },
  { type: 'stump',    gx: 46, gy: 25, v: 0 },
  { type: 'log',      gx: 48, gy: 23, v: 0 },

  // Buildings (departments/offices)
  { type: 'building', gx: 14, gy: 7,  v: 0 },
  { type: 'building', gx: 36, gy: 3,  v: 1 },
  { type: 'building', gx: 26, gy: 30, v: 2 },

  // Rocks
  { type: 'rock',     gx: 24, gy: 20, v: 0 },
  { type: 'rock',     gx: 40, gy: 22, v: 0 },
  { type: 'rock',     gx: 10, gy: 24, v: 0 },
  { type: 'rock',     gx: 32, gy: 8,  v: 0 },

  // Fences
  { type: 'fence',    gx: 12, gy: 10, v: 1 },
  { type: 'fence',    gx: 13, gy: 10, v: 1 },
  { type: 'fence',    gx: 14, gy: 10, v: 1 },
  { type: 'fence',    gx: 15, gy: 10, v: 2 },
  
  { type: 'fence',    gx: 34, gy: 6,  v: 0 },
  { type: 'fence',    gx: 34, gy: 7,  v: 0 },
  { type: 'fence',    gx: 34, gy: 8,  v: 0 },
  { type: 'fence',    gx: 34, gy: 9,  v: 2 },

  // Docks
  { type: 'dock',     gx: 1,  gy: 12, v: 1 },
  { type: 'dock',     gx: 8,  gy: 1,  v: 0 },

  // Lamps and Lights
  { type: 'lamp',     gx: 18, gy: 14, v: 0 },
  { type: 'lamp',     gx: 32, gy: 18, v: 0 },
  { type: 'lamp',     gx: 10, gy: 10, v: 0 },

  // Water Fountain
  { type: 'fountain', gx: 26, gy: 13, v: 0 },

  // Bushes
  { type: 'bush',     gx: 5,  gy: 5,  v: 0 },
  { type: 'bush',     gx: 23, gy: 3,  v: 1 },
  { type: 'bush',     gx: 12, gy: 25, v: 0 },
  { type: 'bush',     gx: 41, gy: 23, v: 1 },
  { type: 'bush',     gx: 17, gy: 21, v: 0 },

  // Ancient Ruins
  { type: 'ruins',    gx: 15, gy: 32, v: 0 },
  { type: 'ruins',    gx: 45, gy: 6,  v: 1 },

  // Flowers
  { type: 'flower',   gx: 17, gy: 13, v: 0 },
  { type: 'flower',   gx: 19, gy: 15, v: 1 },
  { type: 'flower',   gx: 31, gy: 17, v: 2 },
  { type: 'flower',   gx: 33, gy: 19, v: 0 },
  { type: 'flower',   gx: 8,  gy: 15, v: 3 },
  { type: 'flower',   gx: 44, gy: 12, v: 4 },
];

// ── Character State ───────────────────────────────────────────────────────────
interface CharState {
  id: string;
  name: string;
  role: string;
  x: number; y: number;
  tx: number; ty: number;
  dir: 'r' | 'l';
  frame: number;
  moving: boolean;
  idle: number;
  pi: number; // palette index
  wT: number; sT: number; aT: number; cT: number; // equipment tiers
  drag: boolean;
}

// ── Designer stats computed from AppState ────────────────────────────────────
interface DStat {
  id: string; name: string; role: string;
  projArt: number; leadArt: number; intArt: number;
  projCount: number; leadCount: number;
  rating: number | null;
}

function computeStats(state: AppState): DStat[] {
  return state.designers.filter(d => d.active).map(d => {
    const logs = state.artworkLogs;
    const pLogs = logs.filter(l => l.pic_designer_id === d.id && l.work_context === WorkContext.PROJECT);
    const lLogs = logs.filter(l => l.pic_designer_id === d.id && l.work_context === WorkContext.LEAD);
    const iLogs = logs.filter(l => l.pic_designer_id === d.id && l.work_context === WorkContext.INTERNAL);
    const projIDs = new Set(pLogs.map(l => l.project_id)).size;
    const leadIDs = new Set(lLogs.map(l => l.lead_id)).size;
    const myEvals = state.designerEvaluations.filter(e => e.designer_id === d.id);
    let rating: number | null = null;
    if (myEvals.length > 0) {
      const total = myEvals.reduce((sum, ev) => {
        const scores = [ev.inisiatif, ev.disiplin, ev.penyelesaian_tugas, ev.attitude, ev.komunikasi, ev.respon_masukan]
          .filter(Boolean) as number[];
        return sum + (scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0);
      }, 0);
      rating = total / myEvals.length;
    }
    return {
      id: d.id,
      name: d.name.split(' ')[0].slice(0, 9),
      role: d.role,
      projArt: pLogs.length,
      leadArt: lLogs.length,
      intArt:  iLogs.length,
      projCount: projIDs,
      leadCount: leadIDs,
      rating,
    };
  });
}

// ── Main Component ─────────────────────────────────────────────────────────────
interface Props { state: AppState; }

const GamificationWorld: React.FC<Props> = ({ state }) => {
  const stats = useMemo(() => computeStats(state), [state.designers, state.artworkLogs, state.designerEvaluations]);

  const [chars, setChars] = useState<CharState[]>([]);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1.0);
  const [panning, setPanning] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoveredCharId, setHoveredCharId] = useState<string | null>(null);
  const [hoveredTile, setHoveredTile] = useState<{ gx: number; gy: number } | null>(null);

  const panRef  = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const dragRef = useRef({ mx: 0, my: 0, cx: 0, cy: 0 });
  const charsRef = useRef<CharState[]>([]);
  const rafRef   = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Touch tracking for pinch-zoom
  const activePointers = useRef<{ [id: number]: { x: number; y: number } }>({});
  const initialPinchDist = useRef<number | null>(null);
  const initialScale = useRef<number>(1);

  charsRef.current = chars;

  // Pre-compute terrain data
  const terrainData = useMemo(() => {
    const data: { h: number; elev: number; biome: BiomeColors }[][] = [];
    for (let gy = 0; gy < GRID_H; gy++) {
      data[gy] = [];
      for (let gx = 0; gx < GRID_W; gx++) {
        const h = terrainHeight(gx, gy);
        data[gy][gx] = { h, elev: getElevation(h), biome: getBiome(h, gx, gy) };
      }
    }
    return data;
  }, []);

  // Screen to World coords
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { gx: 0, gy: 0 };
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const sx = (mx - offset.x) / scale;
    const sy = (my - offset.y) / scale;
    const u = sx / (TILE_W / 2);
    const v = sy / (TILE_H / 2);
    const gx = Math.floor((v + u) / 2);
    const gy = Math.floor((v - u) / 2);
    return { gx, gy };
  }, [offset, scale]);

  // Init offset to center world
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width: vw, height: vh } = el.getBoundingClientRect();
    const worldCX = (GRID_W / 2 - GRID_H / 2) * (TILE_W / 2);
    const worldCY = (GRID_W / 2 + GRID_H / 2) * (TILE_H / 2);
    setOffset({ x: vw / 2 - worldCX, y: vh / 2 - worldCY - 40 });
  }, []);

  // Wheel zoom listener (non-passive to prevent scroll)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 1.12;
      const nextScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
      const clampedScale = Math.max(0.3, Math.min(3.0, nextScale));

      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = (mx - offset.x) / scale;
      const worldY = (my - offset.y) / scale;

      setOffset({
        x: mx - worldX * clampedScale,
        y: my - worldY * clampedScale,
      });
      setScale(clampedScale);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [scale, offset]);

  // Init characters
  useEffect(() => {
    if (stats.length === 0) return;
    setChars(stats.map((ds, i) => {
      const sx = 6 + Math.floor(Math.random() * (GRID_W - 12));
      const sy = 6 + Math.floor(Math.random() * (GRID_H - 12));
      return {
        id:    ds.id,
        name:  ds.name,
        role:  ds.role,
        x: sx, y: sy, tx: sx, ty: sy,
        dir: 'r',
        frame: Math.floor(Math.random() * 120),
        moving: false,
        idle: Math.floor(Math.random() * 160),
        pi: i % PALETTES.length,
        wT: weaponTier(ds.projArt, ds.projCount),
        sT: shieldTier(ds.leadArt, ds.leadCount),
        aT: armorTier(ds.intArt),
        cT: crownTier(ds.rating),
        drag: false,
      };
    }));
  }, [stats]);

  // Animation loop (throttled to ~30 FPS)
  useEffect(() => {
    let lastTime = 0;
    const tick = (time: number) => {
      if (time - lastTime >= 33) {
        lastTime = time;
        setChars(prev => prev.map(c => {
          if (c.drag) return { ...c, frame: c.frame + 1 };
          const dx = c.tx - c.x;
          const dy = c.ty - c.y;
          const dist = Math.hypot(dx, dy);
          let { x, y, tx, ty, frame, moving, idle, dir } = c;
          if (dist > 0.06) {
            x += (dx / dist) * SPEED * 2;
            y += (dy / dist) * SPEED * 2;
            moving = true;
            frame++;
            dir = dx > 0 ? 'r' : 'l';
          } else {
            x = tx; y = ty; moving = false;
            idle--;
            if (idle <= 0) {
              tx = 5 + Math.floor(Math.random() * (GRID_W - 10));
              ty = 5 + Math.floor(Math.random() * (GRID_H - 10));
              idle = 40 + Math.floor(Math.random() * 100);
            }
          }
          return { ...c, x, y, tx, ty, frame, moving, idle, dir };
        }));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Drag char ──────────────────────────────────────────────────────────────
  const onCharDown = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const c = charsRef.current.find(c => c.id === id)!;
    setDragId(id);
    dragRef.current = { mx: e.clientX, my: e.clientY, cx: c.x, cy: c.y };
    setChars(prev => prev.map(c => c.id === id ? { ...c, drag: true } : c));
  }, []);

  const onCharMove = useCallback((e: React.PointerEvent, id: string) => {
    if (dragId !== id) return;
    const dmx = e.clientX - dragRef.current.mx;
    const dmy = e.clientY - dragRef.current.my;
    const dgx = ((dmx / (TILE_W / 2) + dmy / (TILE_H / 2)) / 2) / scale;
    const dgy = ((dmy / (TILE_H / 2) - dmx / (TILE_W / 2)) / 2) / scale;
    const nx = Math.max(2, Math.min(GRID_W - 3, dragRef.current.cx + dgx));
    const ny = Math.max(2, Math.min(GRID_H - 3, dragRef.current.cy + dgy));
    setChars(prev => prev.map(c => c.id === id ? { ...c, x: nx, y: ny, tx: nx, ty: ny } : c));
  }, [dragId, scale]);

  const onCharUp = useCallback((e: React.PointerEvent, id: string) => {
    if (dragId !== id) return;
    setDragId(null);
    const c = charsRef.current.find(c => c.id === id)!;
    const sx = Math.round(c.x), sy = Math.round(c.y);
    setChars(prev => prev.map(c => c.id === id ? {
      ...c, drag: false, x: sx, y: sy,
      tx: sx + Math.floor(Math.random() * 6) - 3,
      ty: sy + Math.floor(Math.random() * 6) - 3,
      idle: 60 + Math.floor(Math.random() * 100),
    } : c));
  }, [dragId]);

  // ── Pan & Zoom ─────────────────────────────────────────────────────────────
  const onBgDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.no-pan')) return;
    if (dragId) return;

    activePointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    const keys = Object.keys(activePointers.current);

    if (keys.length === 2) {
      setPanning(false);
      const p1 = activePointers.current[Number(keys[0])];
      const p2 = activePointers.current[Number(keys[1])];
      initialPinchDist.current = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      initialScale.current = scale;
    } else if (keys.length === 1) {
      setPanning(true);
      panRef.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
    }
  }, [dragId, offset, scale]);

  const onBgMove = useCallback((e: React.PointerEvent) => {
    if (activePointers.current[e.pointerId]) {
      activePointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    }

    const keys = Object.keys(activePointers.current);
    if (keys.length === 2 && initialPinchDist.current !== null) {
      const p1 = activePointers.current[Number(keys[0])];
      const p2 = activePointers.current[Number(keys[1])];
      const currentDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const ratio = currentDist / initialPinchDist.current;
      const nextScale = Math.max(0.3, Math.min(3.0, initialScale.current * ratio));

      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const midX = ((p1.x + p2.x) / 2) - rect.left;
        const midY = ((p1.y + p2.y) / 2) - rect.top;
        const worldX = (midX - offset.x) / scale;
        const worldY = (midY - offset.y) / scale;

        setOffset({
          x: midX - worldX * nextScale,
          y: midY - worldY * nextScale,
        });
        setScale(nextScale);
      }
    } else if (panning && keys.length === 1) {
      setOffset({
        x: panRef.current.ox + e.clientX - panRef.current.mx,
        y: panRef.current.oy + e.clientY - panRef.current.my,
      });
    }

    // Tile hover tracking
    const { gx, gy } = screenToWorld(e.clientX, e.clientY);
    if (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H) {
      setHoveredTile({ gx, gy });
    } else {
      setHoveredTile(null);
    }
  }, [panning, offset, scale, screenToWorld]);

  const onBgUp = useCallback((e: React.PointerEvent) => {
    delete activePointers.current[e.pointerId];
    if (Object.keys(activePointers.current).length < 2) {
      initialPinchDist.current = null;
    }
    if (Object.keys(activePointers.current).length === 0) {
      setPanning(false);
    }
  }, []);

  const onBgLeave = useCallback((e: React.PointerEvent) => {
    delete activePointers.current[e.pointerId];
    if (Object.keys(activePointers.current).length < 2) {
      initialPinchDist.current = null;
    }
    if (Object.keys(activePointers.current).length === 0) {
      setPanning(false);
      setHoveredTile(null);
    }
  }, []);

  // Sorted by depth for painter's algorithm
  const envSorted = useMemo(() => [...ENV_ELEMENTS].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy)), []);
  const charsSorted = useMemo(() => [...chars].sort((a, b) => (a.x + a.y) - (b.x + b.y)), [chars]);

  // Hover stats details
  const hoveredChar = useMemo(() => chars.find(c => c.id === hoveredCharId), [chars, hoveredCharId]);
  const hoveredDesignerStats = useMemo(() => stats.find(s => s.id === hoveredCharId), [stats, hoveredCharId]);

  // Tile diamond points (constant)
  const tilePts = `0,0 ${TILE_W / 2},${TILE_H / 2} 0,${TILE_H} ${-TILE_W / 2},${TILE_H / 2}`;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        overflow: 'hidden', position: 'relative',
        background: 'linear-gradient(180deg, #4a7fb5 0%, #6ba8d0 25%, #8ec5e0 50%, #b8dce8 75%, #d8eff5 100%)',
        cursor: panning ? 'grabbing' : dragId ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={onBgDown}
      onPointerMove={onBgMove}
      onPointerUp={onBgUp}
      onPointerLeave={onBgLeave}
    >
      {/* Clouds */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {[
          { x: '12%', y: '6%', w: 140, h: 32, o: 0.35 },
          { x: '40%', y: '3%', w: 200, h: 40, o: 0.25 },
          { x: '70%', y: '10%', w: 120, h: 28, o: 0.3 },
          { x: '25%', y: '14%', w: 100, h: 24, o: 0.2 },
          { x: '85%', y: '5%', w: 90, h: 22, o: 0.18 },
          { x: '55%', y: '8%', w: 160, h: 35, o: 0.22 },
        ].map((cloud, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: cloud.x,
            top: cloud.y,
            width: cloud.w,
            height: cloud.h,
            borderRadius: '50%',
            background: `rgba(255,255,255,${cloud.o})`,
            filter: 'blur(10px)',
          }} />
        ))}
      </div>

      {/* World SVG */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
        <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>

          {/* ── Terrain tiles with elevation ── */}
          {Array.from({ length: GRID_H }, (_, gy) =>
            Array.from({ length: GRID_W }, (_, gx) => {
              const { sx, sy } = g2s(gx, gy);
              const td = terrainData[gy][gx];
              const elev = td.elev;
              const b = td.biome;

              return (
                <g key={`t${gx}-${gy}`} transform={`translate(${sx}, ${sy - elev})`}>
                  {/* Left wall (visible cliff face) facing front-left */}
                  {(() => {
                    const neighborL = gy + 1 < GRID_H ? terrainData[gy + 1][gx] : null;
                    const elevL = neighborL ? neighborL.elev : 0;
                    const diffL = elev - elevL;
                    if (diffL <= 0) return null;
                    return (
                      <g>
                        {/* Main Cliff Face */}
                        <polygon
                          points={`${-TILE_W / 2},${TILE_H / 2} 0,${TILE_H} 0,${TILE_H + diffL} ${-TILE_W / 2},${TILE_H / 2 + diffL}`}
                          fill={b.left}
                        />
                        {/* Vertical Rock Column dividers */}
                        <line x1={-10.6} y1={26.7} x2={-10.6} y2={26.7 + diffL} stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" />
                        <line x1={-21.3} y1={21.4} x2={-21.3} y2={21.4 + diffL} stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" />
                        {/* Grass lip overlay (if biome is grass) */}
                        {b.top.startsWith('#8') || b.top.startsWith('#7') ? (
                          <polygon
                            points={`${-TILE_W / 2},${TILE_H / 2} 0,${TILE_H} 0,${TILE_H + 3.5} ${-TILE_W / 2},${TILE_H / 2 + 3.5}`}
                            fill={b.top}
                            opacity={0.95}
                          />
                        ) : null}
                      </g>
                    );
                  })()}

                  {/* Right wall (visible cliff face) facing front-right */}
                  {(() => {
                    const neighborR = gx + 1 < GRID_W ? terrainData[gy][gx + 1] : null;
                    const elevR = neighborR ? neighborR.elev : 0;
                    const diffR = elev - elevR;
                    if (diffR <= 0) return null;
                    return (
                      <g>
                        {/* Main Cliff Face */}
                        <polygon
                          points={`0,${TILE_H} ${TILE_W / 2},${TILE_H / 2} ${TILE_W / 2},${TILE_H / 2 + diffR} 0,${TILE_H + diffR}`}
                          fill={b.right}
                        />
                        {/* Vertical Rock Column dividers */}
                        <line x1={10.6} y1={26.7} x2={10.6} y2={26.7 + diffR} stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" />
                        <line x1={21.3} y1={21.4} x2={21.3} y2={21.4 + diffR} stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" />
                        {/* Grass lip overlay (if biome is grass) */}
                        {b.top.startsWith('#8') || b.top.startsWith('#7') ? (
                          <polygon
                            points={`0,${TILE_H} ${TILE_W / 2},${TILE_H / 2} ${TILE_W / 2},${TILE_H / 2 + 3.5} 0,${TILE_H + 3.5}`}
                            fill={b.top}
                            opacity={0.95}
                          />
                        ) : null}
                      </g>
                    );
                  })()}

                  {/* Top face (diamond) */}
                  <polygon
                    points={tilePts}
                    fill={b.top}
                    stroke={b.stroke}
                    strokeWidth="0.5"
                  />
                </g>
              );
            })
          )}

          {/* Highlighted Tile */}
          {hoveredTile && (() => {
            const td = terrainData[hoveredTile.gy]?.[hoveredTile.gx];
            const elev = td ? td.elev : 0;
            const pos = g2s(hoveredTile.gx, hoveredTile.gy);
            return (
              <g transform={`translate(${pos.sx}, ${pos.sy - elev})`}>
                <polygon
                  points={tilePts}
                  fill="rgba(255,255,255,0.18)"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="1.5"
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            );
          })()}

          {/* ── Environment + Characters (depth-sorted together) ── */}
          {(() => {
            type Item =
              | { kind: 'env'; depth: number; el: typeof ENV_ELEMENTS[0] }
              | { kind: 'char'; depth: number; c: CharState };

            const items: Item[] = [
              ...envSorted.map(el => ({ kind: 'env' as const, depth: el.gx + el.gy, el })),
              ...charsSorted.map(c => ({ kind: 'char' as const, depth: c.x + c.y, c })),
            ].sort((a, b) => a.depth - b.depth);

            return items.map((item, idx) => {
              if (item.kind === 'env') {
                const { sx, sy } = g2s(item.el.gx, item.el.gy);
                const td = terrainData[item.el.gy]?.[item.el.gx];
                const elev = td ? td.elev : 0;
                const baseY = sy - elev;
                if (item.el.type === 'tree')     return <EnvTree     key={`e${idx}`} sx={sx} sy={baseY} variant={item.el.v} />;
                if (item.el.type === 'building') return <EnvBuilding key={`e${idx}`} sx={sx} sy={baseY} variant={item.el.v} />;
                if (item.el.type === 'rock')     return <EnvRock     key={`e${idx}`} sx={sx} sy={baseY} />;
                if (item.el.type === 'lamp')     return <EnvLamp     key={`e${idx}`} sx={sx} sy={baseY} />;
                if (item.el.type === 'bush')     return <EnvBush     key={`e${idx}`} sx={sx} sy={baseY} variant={item.el.v} />;
                if (item.el.type === 'fountain') return <EnvFountain key={`e${idx}`} sx={sx} sy={baseY} />;
                if (item.el.type === 'ruins')    return <EnvRuins    key={`e${idx}`} sx={sx} sy={baseY} variant={item.el.v} />;
                if (item.el.type === 'flower')   return <EnvFlower   key={`e${idx}`} sx={sx} sy={baseY} variant={item.el.v} />;
                if (item.el.type === 'fence')    return <EnvFence    key={`e${idx}`} sx={sx} sy={baseY} variant={item.el.v} />;
                if (item.el.type === 'stump')    return <EnvStump    key={`e${idx}`} sx={sx} sy={baseY} />;
                if (item.el.type === 'log')      return <EnvLog      key={`e${idx}`} sx={sx} sy={baseY} variant={item.el.v} />;
                if (item.el.type === 'dock')     return <EnvDock     key={`e${idx}`} sx={sx} sy={baseY} variant={item.el.v} />;
                return null;
              } else {
                const c = item.c;
                const { sx, sy } = g2s(c.x, c.y);
                const elev = getCharElevation(c.x, c.y, terrainData);
                const pal = PALETTES[c.pi];
                return (
                  <g
                    key={c.id}
                    transform={`translate(${sx}, ${sy - elev - 4})`}
                    style={{ pointerEvents: 'all', cursor: c.drag ? 'grabbing' : 'grab' }}
                    onPointerDown={e => onCharDown(e, c.id)}
                    onPointerMove={e => onCharMove(e, c.id)}
                    onPointerUp={e => onCharUp(e, c.id)}
                    onPointerOver={() => setHoveredCharId(c.id)}
                    onPointerOut={() => setHoveredCharId(null)}
                  >
                    <PixelChar
                      pal={pal} wTier={c.wT} sTier={c.sT} aTier={c.aT} cTier={c.cT}
                      frame={c.frame} moving={c.moving} name={c.name} isDragging={c.drag}
                    />
                  </g>
                );
              }
            });
          })()}
        </g>
      </svg>

      {/* Floating Statistics Tooltip */}
      {hoveredChar && hoveredDesignerStats && (() => {
        const { sx, sy } = g2s(hoveredChar.x, hoveredChar.y);
        const elev = getCharElevation(hoveredChar.x, hoveredChar.y, terrainData);
        const charScreenX = offset.x + sx * scale;
        const charScreenY = offset.y + (sy - elev - 72) * scale;
        return (
          <div
            className="no-pan"
            onPointerDown={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: charScreenX,
              top: charScreenY,
              transform: 'translate(-50%, -100%)',
              marginTop: -16,
              background: 'rgba(5, 5, 12, 0.94)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
              borderRadius: 6,
              padding: '10px 14px',
              zIndex: 100,
              width: 220,
              color: 'rgba(255, 255, 255, 0.95)',
              fontFamily: 'monospace',
              pointerEvents: 'none',
            }}
          >
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 5, marginBottom: 7 }}>
              <h4 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {hoveredChar.name}
              </h4>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)' }}>{hoveredChar.role}</span>
            </div>

            {hoveredDesignerStats.rating !== null && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, fontSize: 9 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>EVAL RATING:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontWeight: 700, color: '#fbbf24' }}>
                    {hoveredDesignerStats.rating.toFixed(2)}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>5.0</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>PROJECTS:</span>
                <span style={{ fontWeight: 700 }}>
                  {hoveredDesignerStats.projCount} projs ({hoveredDesignerStats.projArt} arts)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>LEADS:</span>
                <span style={{ fontWeight: 700 }}>
                  {hoveredDesignerStats.leadCount} leads ({hoveredDesignerStats.leadArt} arts)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>INTERNAL:</span>
                <span style={{ fontWeight: 700 }}>
                  {hoveredDesignerStats.intArt} arts
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 7, paddingTop: 5, display: 'flex', flexWrap: 'wrap', gap: '3px 6px', fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
              <div>CROWN: T{hoveredChar.cT}</div>
              <div>SWORD: T{hoveredChar.wT}</div>
              <div>SHIELD: T{hoveredChar.sT}</div>
              <div>ARMOR: T{hoveredChar.aT}</div>
            </div>
          </div>
        );
      })()}

      {/* Top bar */}
      <div
        className="no-pan"
        onPointerDown={e => e.stopPropagation()}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
          background: 'rgba(4,4,12,0.88)', backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <polygon points="9,1 17,5 17,13 9,17 1,13 1,5" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.5)" strokeWidth="1" />
            <polygon points="9,1 17,5 9,9 1,5" fill="rgba(99,102,241,0.3)" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.01em', fontFamily: 'monospace' }}>ACS WORLD</span>
          <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(99,102,241,0.7)', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 3, padding: '1px 5px', letterSpacing: '0.06em' }}>BETA</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 5, height: 5, background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>{chars.length} online</span>
          </div>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace' }}>DRAG CHARS · PAN/PINCH TO EXPLORE</span>
          <Link
            to="/admin/dashboard"
            style={{
              fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 5, padding: '4px 10px', textDecoration: 'none', fontFamily: 'monospace',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
          >
            ← BACK
          </Link>
        </div>
      </div>

      {/* Legend panel */}
      <div
        className="no-pan"
        onPointerDown={e => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 14, right: 14,
          background: 'rgba(4,4,12,0.88)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8, padding: '10px 14px', backdropFilter: 'blur(10px)',
          maxWidth: 210, maxHeight: 'calc(100% - 80px)', overflowY: 'auto', zIndex: 10,
        }}
      >
        <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'monospace' }}>TEAM</p>
        {chars.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <div style={{ width: 7, height: 7, background: PALETTES[c.pi].body, boxShadow: `0 0 5px ${PALETTES[c.pi].body}`, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', lineHeight: 1.3 }}>{c.name.toUpperCase()}</p>
              <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.role}</p>
            </div>
            {/* Equipment dots */}
            <div style={{ display: 'flex', gap: 2 }}>
              {c.cT > 0 && <div title={`Crown T${c.cT}`} style={{ width: 4, height: 4, background: '#fbbf24' }} />}
              {c.wT > 0 && <div style={{ width: 4, height: 4, background: '#6366f1' }} />}
              {c.sT > 0 && <div style={{ width: 4, height: 4, background: '#22c55e' }} />}
              {c.aT > 0 && <div style={{ width: 4, height: 4, background: '#f97316' }} />}
            </div>
          </div>
        ))}
        {/* Legend key */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 8, paddingTop: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[
            { col: '#fbbf24', label: 'Crown = Eval' },
            { col: '#6366f1', label: 'Sword = Projects' },
            { col: '#22c55e', label: 'Shield = Leads' },
            { col: '#f97316', label: 'Armor = Internal' },
          ].map(({ col, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 5, height: 5, background: col }} />
              <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(4,4,12,0.7)', border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: 20, padding: '4px 14px', zIndex: 10, pointerEvents: 'none',
      }}>
        <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
          PINCH OR SCROLL TO ZOOM · DRAG TO EXPLORE
        </p>
      </div>
    </div>
  );
};

export default GamificationWorld;
