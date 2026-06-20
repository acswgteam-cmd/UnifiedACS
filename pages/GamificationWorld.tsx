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
          {/* Simple 3-point gold crown */}
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
          {/* Crown with center gem */}
          <rect x={-12} y={0} width={24} height={7} fill="#f59e0b" />
          <rect x={-12} y={0} width={24} height={2} fill="#fde68a" />
          <rect x={-12} y={-7} width={7} height={7} fill="#f59e0b" />
          <rect x={-2} y={-11} width={4} height={11} fill="#f59e0b" />
          <rect x={5} y={-7} width={7} height={7} fill="#f59e0b" />
          {/* Center gem */}
          <rect x={-2} y={-10} width={4} height={4} fill="#ef4444" />
          <rect x={-1} y={-10} width={2} height={2} fill="rgba(255,255,255,0.6)" />
          <rect x={-12} y={5} width={24} height={2} fill="#78350f" />
        </g>
      )}
      {tier === 3 && (
        <g>
          {/* Ornate 5-point crown */}
          <rect x={-14} y={0} width={28} height={8} fill="#d97706" />
          <rect x={-14} y={0} width={28} height={2} fill="#fde68a" />
          <rect x={-14} y={-8} width={8} height={8} fill="#d97706" />
          <rect x={-5} y={-14} width={5} height={14} fill="#d97706" />
          <rect x={0} y={-16} width={4} height={16} fill="#f59e0b" />
          <rect x={4} y={-14} width={5} height={14} fill="#d97706" />
          <rect x={6} y={-8} width={8} height={8} fill="#d97706" />
          {/* Gems */}
          <rect x={-1} y={-14} width={6} height={6} fill="#a855f7" />
          <rect x={0} y={-14} width={3} height={3} fill="rgba(255,255,255,0.7)" />
          <rect x={-13} y={-6} width={4} height={4} fill="#3b82f6" />
          <rect x={9} y={-6} width={4} height={4} fill="#3b82f6" />
          <rect x={-14} y={6} width={28} height={2} fill="#78350f" />
        </g>
      )}
      {tier === 4 && (
        <g>
          {/* Legendary glowing crown */}
          <rect x={-18} y={-20} width={36} height={28} fill="rgba(251,191,36,0.1)" />
          <rect x={-16} y={0} width={32} height={9} fill="#b45309" />
          <rect x={-16} y={0} width={32} height={2} fill="#fde68a" />
          <rect x={-16} y={-10} width={9} height={10} fill="#b45309" />
          <rect x={-7} y={-17} width={6} height={17} fill="#d97706" />
          <rect x={-3} y={-20} width={6} height={20} fill="#f59e0b" />
          <rect x={1} y={-17} width={6} height={17} fill="#d97706" />
          <rect x={7} y={-10} width={9} height={10} fill="#b45309" />
          {/* Many gems */}
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
        // Wooden staff
        <g>
          <rect x={0} y={-48} width={4} height={54} fill="#92400e" />
          <rect x={1} y={-48} width={2} height={54} fill="#a16207" />
          <rect x={-2} y={-48} width={8} height={4} fill="#78350f" />
        </g>
      )}
      {tier === 2 && (
        // Iron short sword
        <g>
          <rect x={0} y={-36} width={4} height={42} fill="#6b7280" />
          <rect x={1} y={-36} width={2} height={42} fill="#9ca3af" />
          <rect x={-5} y={4} width={14} height={4} fill="#374151" /> {/* crossguard */}
          <rect x={0} y={-36} width={4} height={6} fill="#1f2937" /> {/* pommel */}
          <rect x={1} y={-36} width={2} height={2} fill="#9ca3af" />
        </g>
      )}
      {tier === 3 && (
        // Steel broadsword
        <g>
          <rect x={-1} y={-46} width={6} height={52} fill="#d1d5db" />
          <rect x={-1} y={-46} width={2} height={52} fill="#e5e7eb" />
          <rect x={1} y={-46} width={2} height={52} fill="#9ca3af" />
          <rect x={-7} y={4} width={18} height={5} fill="#f59e0b" /> {/* gold crossguard */}
          <rect x={-7} y={5} width={18} height={2} fill="#fbbf24" />
          <rect x={0} y={-46} width={4} height={8} fill="#1f2937" />
          <rect x={-1} y={-20} width={6} height={2} fill="#9ca3af" /> {/* fuller */}
        </g>
      )}
      {tier === 4 && (
        // Legendary axe
        <g>
          <rect x={-14} y={-52} width={28} height={22} fill="rgba(139,92,246,0.2)" />
          {/* Axe head */}
          <rect x={-16} y={-52} width={20} height={22} fill="#5b21b6" />
          <rect x={-16} y={-52} width={4} height={22} fill="#4c1d95" />
          <rect x={4} y={-52} width={4} height={22} fill="#7c3aed" />
          <rect x={-16} y={-52} width={20} height={3} fill="#a78bfa" />
          <rect x={-16} y={-32} width={20} height={3} fill="#a78bfa" />
          {/* Handle */}
          <rect x={0} y={-30} width={4} height={36} fill="#92400e" />
          <rect x={1} y={-30} width={2} height={36} fill="#a16207" />
          {/* Gem on axe */}
          <rect x={-6} y={-44} width={8} height={8} fill="#ec4899" />
          <rect x={-5} y={-44} width={4} height={4} fill="rgba(255,255,255,0.6)" />
          {/* Glow outline */}
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
        // Wood buckler
        <g>
          <rect x={-4} y={-14} width={14} height={14} fill="#92400e" />
          <rect x={-4} y={-14} width={14} height={3} fill="#a16207" />
          <rect x={-4} y={-14} width={3} height={14} fill="#78350f" />
          <rect x={2} y={-10} width={4} height={4} fill="#fbbf24" />
        </g>
      )}
      {tier === 2 && (
        // Iron kite shield
        <g>
          <rect x={-6} y={-22} width={18} height={18} fill="#1e3a8a" />
          <rect x={-2} y={-4} width={10} height={8} fill="#1e3a8a" />
          <rect x={2} y={4} width={2} height={4} fill="#1e3a8a" />
          <rect x={-6} y={-22} width={18} height={3} fill="#2563eb" />
          <rect x={-6} y={-22} width={3} height={22} fill="#1e40af" />
          {/* Emblem */}
          <rect x={0} y={-14} width={6} height={3} fill="#fbbf24" />
          <rect x={2} y={-16} width={2} height={7} fill="#fbbf24" />
        </g>
      )}
      {tier === 3 && (
        // Steel heater shield
        <g>
          <rect x={-8} y={-26} width={22} height={18} fill="#374151" />
          <rect x={-8} y={-8} width={11} height={10} fill="#374151" />
          <rect x={3} y={-8} width={11} height={6} fill="#374151" />
          <rect x={1} y={-2} width={4} height={4} fill="#374151" />
          <rect x={-8} y={-26} width={22} height={3} fill="#9ca3af" />
          <rect x={-8} y={-26} width={3} height={28} fill="#1f2937" />
          {/* Cross */}
          <rect x={-5} y={-19} width={16} height={3} fill="#fbbf24" />
          <rect x={1} y={-26} width={4} height={26} fill="#fbbf24" opacity={0.5} />
        </g>
      )}
      {tier === 4 && (
        // Legendary tower shield
        <g>
          <rect x={-12} y={-34} width={28} height={44} fill="rgba(16,185,129,0.15)" />
          <rect x={-10} y={-32} width={24} height={20} fill="#065f46" />
          <rect x={-10} y={-12} width={12} height={14} fill="#065f46" />
          <rect x={2} y={-12} width={12} height={10} fill="#065f46" />
          <rect x={1} y={-2} width={6} height={6} fill="#065f46" />
          <rect x={-10} y={-32} width={24} height={3} fill="#34d399" />
          <rect x={-10} y={-32} width={3} height={38} fill="#047857" />
          {/* Rune pattern */}
          <rect x={-7} y={-26} width={18} height={2} fill="#34d399" />
          <rect x={-7} y={-16} width={18} height={2} fill="#34d399" />
          <rect x={-2} y={-32} width={4} height={32} fill="#34d399" opacity={0.4} />
          {/* Gem */}
          <rect x={-2} y={-22} width={6} height={6} fill="#6ee7b7" />
          <rect x={-1} y={-22} width={3} height={3} fill="rgba(255,255,255,0.7)" />
        </g>
      )}
    </g>
  );
};

// ── Pixel Art Character ───────────────────────────────────────────────────────
const PixelChar: React.FC<{
  pal: typeof PALETTES[0];
  wTier: number; sTier: number; aTier: number; cTier: number;
  frame: number; moving: boolean; name: string; isDragging: boolean;
}> = ({ pal, wTier, sTier, aTier, cTier, frame, moving, name, isDragging }) => {
  const leg  = moving ? Math.sin(frame * 0.22) * 8 : 0;
  const arm  = moving ? Math.sin(frame * 0.22 + Math.PI) * 8 : 0;
  const bob  = moving ? Math.abs(Math.sin(frame * 0.22)) * 2 : 0;
  const flt  = Math.sin(frame * 0.045) * 3; // crown float

  const bC   = aTier > 0 ? ARMOR_BODY[aTier] : pal.body;
  const bD   = aTier > 0 ? ARMOR_DARK[aTier] : pal.bodyDk;
  const bH   = aTier > 0 ? ARMOR_HI[aTier] : pal.bodyDk;

  const bY   = -bob; // body bob offset
  const footY = 0;
  const legBaseY = -8 + bY;
  const bodyBaseY = -28 + bY;
  const headBaseY = -50 + bY;
  const armBaseY  = -26 + bY;
  const handRY    = armBaseY + 14 - arm; // right hand Y
  const handLY    = armBaseY + 14 + arm; // left hand Y

  return (
    <g style={{ filter: isDragging ? 'brightness(1.3) drop-shadow(0 10px 18px rgba(0,0,0,0.8))' : 'drop-shadow(0 3px 8px rgba(0,0,0,0.55))' }}>
      {/* Shadow */}
      <ellipse cx={0} cy={footY + 3} rx={isDragging ? 22 : 17} ry={isDragging ? 7 : 5} fill="rgba(0,0,0,0.3)" />

      {/* ── SHOES ── */}
      <rect x={-16} y={footY - 7} width={14} height={7} fill={pal.shoe} />
      <rect x={-16} y={footY - 7} width={14} height={2} fill="rgba(255,255,255,0.12)" />
      <rect x={2}   y={footY - 7} width={14} height={7} fill={pal.shoe} />
      <rect x={2}   y={footY - 7} width={14} height={2} fill="rgba(255,255,255,0.12)" />

      {/* ── LEGS ── */}
      <rect x={-12} y={legBaseY - 20 + leg} width={10} height={20} fill={pal.pants} />
      <rect x={-12} y={legBaseY - 20 + leg} width={3}  height={20} fill={pal.pantsDk} />
      <rect x={2}   y={legBaseY - 20 - leg} width={10} height={20} fill={pal.pants} />
      <rect x={9}   y={legBaseY - 20 - leg} width={3}  height={20} fill={pal.pantsDk} />

      {/* ── BODY ── */}
      <rect x={-13} y={bodyBaseY} width={26} height={20} fill={bC} />
      <rect x={-13} y={bodyBaseY} width={4}  height={20} fill={bD} />
      <rect x={9}   y={bodyBaseY} width={4}  height={20} fill={bD} />

      {/* Armor decoration */}
      {aTier === 1 && (
        <g>
          <rect x={-9} y={bodyBaseY + 3} width={18} height={3} fill={bH} />
          <rect x={-9} y={bodyBaseY + 11} width={18} height={3} fill={bH} />
        </g>
      )}
      {aTier === 2 && (
        <g>
          {[-1, 5, 11].map(dy => (
            <rect key={dy} x={-9} y={bodyBaseY + dy} width={18} height={2} fill={bH} opacity={0.5} />
          ))}
          {[-8, -3, 2, 7].map(dx => (
            <rect key={dx} x={dx} y={bodyBaseY} width={2} height={20} fill={bH} opacity={0.3} />
          ))}
        </g>
      )}
      {aTier === 3 && (
        <g>
          <rect x={-7} y={bodyBaseY + 1} width={14} height={17} fill={bH} opacity={0.4} />
          <rect x={-7} y={bodyBaseY + 1} width={14} height={2} fill="rgba(255,255,255,0.15)" />
          <rect x={-9} y={bodyBaseY} width={2} height={20} fill="rgba(255,255,255,0.08)" />
        </g>
      )}
      {aTier === 4 && (
        <g>
          <rect x={-13} y={bodyBaseY} width={26} height={20} fill="rgba(99,102,241,0.18)" />
          <rect x={-7}  y={bodyBaseY + 1} width={14} height={17} fill={bH} opacity={0.35} />
          <rect x={-9}  y={bodyBaseY + 3} width={18} height={2} fill={bH} />
          <rect x={-9}  y={bodyBaseY + 11} width={18} height={2} fill={bH} />
          <rect x={-1}  y={bodyBaseY} width={2} height={20} fill={bH} opacity={0.6} />
        </g>
      )}

      {/* ── LEFT ARM ── */}
      <rect x={-21} y={armBaseY + arm} width={8} height={14} fill={bC} />
      <rect x={-21} y={armBaseY + arm} width={2} height={14} fill={bD} />
      {/* Left hand */}
      <rect x={-21} y={handLY} width={8} height={6} fill={pal.skin} />
      <rect x={-21} y={handLY} width={8} height={2} fill={pal.skinDk} />

      {/* ── RIGHT ARM ── */}
      <rect x={13} y={armBaseY - arm} width={8} height={14} fill={bC} />
      <rect x={19} y={armBaseY - arm} width={2} height={14} fill={bD} />
      {/* Right hand */}
      <rect x={13} y={handRY} width={8} height={6} fill={pal.skin} />
      <rect x={13} y={handRY} width={8} height={2} fill={pal.skinDk} />

      {/* ── SHIELD (left hand) ── */}
      <Shield tier={sTier} handY={handLY} />

      {/* ── WEAPON (right hand) ── */}
      <Weapon tier={wTier} handY={handRY} />

      {/* ── HEAD ── */}
      <rect x={-11} y={headBaseY} width={22} height={18} fill={pal.skin} />
      <rect x={-11} y={headBaseY} width={4}  height={18} fill={pal.skinDk} />
      {/* Hair */}
      <rect x={-11} y={headBaseY}     width={22} height={6} fill={pal.hair} />
      <rect x={-13} y={headBaseY + 2} width={4}  height={10} fill={pal.hair} />
      <rect x={9}   y={headBaseY + 2} width={4}  height={10} fill={pal.hair} />
      {/* Eyes */}
      <rect x={-7} y={headBaseY + 7} width={5} height={5} fill="#0f172a" />
      <rect x={2}  y={headBaseY + 7} width={5} height={5} fill="#0f172a" />
      <rect x={-6} y={headBaseY + 7} width={2} height={2} fill="rgba(255,255,255,0.35)" />
      <rect x={3}  y={headBaseY + 7} width={2} height={2} fill="rgba(255,255,255,0.35)" />
      {/* Mouth */}
      <rect x={-4} y={headBaseY + 14} width={8} height={2} fill={pal.skinDk} />

      {/* ── CROWN ── */}
      <Crown tier={cTier} float={flt} />

      {/* ── NAME TAG ── */}
      <g transform="translate(0, -98)">
        <rect x={-name.length * 3.8 - 4} y={-10} width={name.length * 7.6 + 8} height={14} fill="rgba(0,0,0,0.82)" />
        <rect x={-name.length * 3.8 - 4} y={-10} width={name.length * 7.6 + 8} height={1}  fill="rgba(255,255,255,0.08)" />
        <text textAnchor="middle" y={1} fontSize="9" fontFamily="'Courier New', Courier, monospace"
          fontWeight="700" fill="rgba(255,255,255,0.92)" letterSpacing="1">
          {name.toUpperCase()}
        </text>
      </g>
    </g>
  );
};

// ── Iso Tile ──────────────────────────────────────────────────────────────────
const IsoTile: React.FC<{ gx: number; gy: number }> = ({ gx, gy }) => {
  const pts = `0,0 ${TILE_W / 2},${TILE_H / 2} 0,${TILE_H} ${-TILE_W / 2},${TILE_H / 2}`;
  const isEdge = gx === 0 || gy === 0 || gx === GRID_W - 1 || gy === GRID_H - 1;
  const alt = (gx + gy) % 2 === 0;
  return (
    <polygon
      points={pts}
      fill={isEdge ? 'rgba(99,102,241,0.07)' : alt ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.04)'}
      stroke={isEdge ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.055)'}
      strokeWidth="0.5"
    />
  );
};

// ── Environment Elements ──────────────────────────────────────────────────────
const EnvTree: React.FC<{ sx: number; sy: number; variant: number }> = ({ sx, sy, variant }) => {
  const g = [
    ['#15803d', '#16a34a', '#22c55e'],
    ['#166534', '#15803d', '#4ade80'],
    ['#14532d', '#166534', '#16a34a'],
  ][variant % 3];
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={2} rx={22} ry={8} fill="rgba(0,0,0,0.15)" />
      {/* Trunk */}
      <rect x={-4} y={-40} width={8} height={40} fill="#78350f" />
      <rect x={-2} y={-40} width={2} height={40} fill="#a16207" />
      {/* Canopy layers */}
      <rect x={-24} y={-62} width={48} height={26} fill={g[0]} />
      <rect x={-24} y={-36} width={24} height={5} fill={g[0]} opacity={0.6} />
      <rect x={-18} y={-76} width={36} height={18} fill={g[1]} />
      <rect x={-10} y={-88} width={20} height={14} fill={g[2]} />
      <rect x={-6}  y={-90} width={12} height={4}  fill="rgba(255,255,255,0.08)" />
    </g>
  );
};

const EnvBuilding: React.FC<{ sx: number; sy: number; variant: number }> = ({ sx, sy, variant }) => {
  const cfg = [
    { wM: '#1e293b', wD: '#0f172a', rf: '#334155', win: '#6366f1', h: 72 },
    { wM: '#111827', wD: '#030712', rf: '#1f2937', win: '#8b5cf6', h: 96 },
    { wM: '#1c1917', wD: '#0c0a09', rf: '#292524', win: '#0ea5e9', h: 56 },
  ][variant % 3];
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={4} rx={32} ry={10} fill="rgba(0,0,0,0.22)" />
      {/* Left wall */}
      <polygon points={`-32,0 0,16 0,${16 - cfg.h} -32,${-cfg.h}`} fill={cfg.wD} />
      {/* Right wall */}
      <polygon points={`0,16 32,0 32,${-cfg.h} 0,${16 - cfg.h}`} fill={cfg.wM} />
      {/* Windows right */}
      <rect x={8}  y={-cfg.h + 18} width={10} height={10} fill={cfg.win} opacity={0.65} />
      <rect x={22} y={-cfg.h + 18} width={10} height={10} fill={cfg.win} opacity={0.65} />
      <rect x={8}  y={-cfg.h + 36} width={10} height={10} fill={cfg.win} opacity={0.4}  />
      <rect x={22} y={-cfg.h + 36} width={10} height={10} fill={cfg.win} opacity={0.4}  />
      {/* Windows left */}
      <rect x={-28} y={-cfg.h + 18} width={10} height={10} fill={cfg.win} opacity={0.4}  />
      <rect x={-14} y={-cfg.h + 18} width={10} height={10} fill={cfg.win} opacity={0.35} />
      {/* Roof top face */}
      <polygon points={`-32,${-cfg.h} 0,${-cfg.h - 16} 32,${-cfg.h} 0,${-cfg.h + 16}`} fill={cfg.rf} />
      <polygon points={`-32,${-cfg.h} 0,${-cfg.h - 16} 2,${-cfg.h - 14} -30,${-cfg.h + 2}`} fill="rgba(255,255,255,0.06)" />
    </g>
  );
};

const EnvRock: React.FC<{ sx: number; sy: number }> = ({ sx, sy }) => (
  <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
    <ellipse cx={0} cy={4} rx={20} ry={7} fill="rgba(0,0,0,0.18)" />
    <rect x={-18} y={-10} width={36} height={10} fill="#374151" />
    <rect x={-14} y={-20} width={28} height={12} fill="#4b5563" />
    <rect x={-8}  y={-26} width={16} height={8}  fill="#6b7280" />
    <rect x={-18} y={-10} width={8}  height={10} fill="#1f2937" />
    <rect x={-12} y={-20} width={6}  height={6}  fill="rgba(255,255,255,0.05)" />
  </g>
);

const EnvLamp: React.FC<{ sx: number; sy: number }> = ({ sx, sy }) => (
  <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
    <ellipse cx={0} cy={3} rx={8} ry={4} fill="rgba(0,0,0,0.2)" />
    <rect x={-3} y={-44} width={6} height={44} fill="#374151" />
    <rect x={-1} y={-44} width={2} height={44} fill="#4b5563" />
    <rect x={-3} y={-44} width={6} height={4} fill="#6b7280" />
    <rect x={-6} y={-48} width={12} height={6} fill="#374151" />
    <ellipse cx={0} cy={-48} rx={8} ry={4} fill="rgba(99,102,241,0.5)" />
    <ellipse cx={0} cy={-48} rx={5} ry={2.5} fill="rgba(165,180,252,0.8)" />
    {/* Glow */}
    <ellipse cx={0} cy={-44} rx={14} ry={10} fill="rgba(99,102,241,0.1)" />
  </g>
);

const EnvBush: React.FC<{ sx: number; sy: number; variant: number }> = ({ sx, sy, variant }) => {
  const colors = [
    ['#166534', '#15803d', '#22c55e'],
    ['#0f766e', '#14b8a6', '#5eead4'],
  ][variant % 2];
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={2} rx={14} ry={5} fill="rgba(0,0,0,0.15)" />
      {/* Lower leaves */}
      <rect x={-10} y={-8} width={20} height={8} fill={colors[0]} />
      {/* Mid leaves */}
      <rect x={-12} y={-16} width={24} height={9} fill={colors[1]} />
      {/* Top leaves */}
      <rect x={-8} y={-22} width={16} height={7} fill={colors[2]} />
      <rect x={-4} y={-24} width={8} height={3} fill="rgba(255,255,255,0.15)" />
    </g>
  );
};

const EnvFountain: React.FC<{ sx: number; sy: number }> = ({ sx, sy }) => {
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={4} rx={26} ry={9} fill="rgba(0,0,0,0.2)" />
      {/* Rim structure */}
      <polygon points="-24,0 0,10 24,0 0,-10" fill="#374151" />
      <polygon points="-24,3 0,13 24,3 24,0 0,10 -24,0" fill="#1f2937" />
      {/* Water inside basin */}
      <polygon points="-22,0 0,8 22,0 0,-8" fill="#0284c7" />
      {/* Spire */}
      <rect x={-3} y={-18} width={6} height={18} fill="#4b5563" />
      <rect x={-1} y={-18} width={2} height={18} fill="#9ca3af" />
      {/* Water spray */}
      <rect x={-5} y={-24} width={10} height={7} fill="#e0f2fe" opacity={0.7} />
      <rect x={-2} y={-28} width={4} height={5} fill="#ffffff" opacity={0.9} />
      {/* Water droplets around */}
      <rect x={-12} y={-6} width={2} height={2} fill="#bae6fd" opacity={0.6} />
      <rect x={10} y={-6} width={2} height={2} fill="#bae6fd" opacity={0.6} />
    </g>
  );
};

const EnvRuins: React.FC<{ sx: number; sy: number; variant: number }> = ({ sx, sy, variant }) => {
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={3} rx={18} ry={6} fill="rgba(0,0,0,0.15)" />
      {variant % 2 === 0 ? (
        // Pillar fragment
        <g>
          <rect x={-6} y={-32} width={12} height={32} fill="#4b5563" />
          <rect x={-4} y={-32} width={2} height={32} fill="#9ca3af" />
          <rect x={-8} y={-36} width={16} height={5} fill="#374151" />
          {/* Cracked detail */}
          <rect x={-2} y={-20} width={4} height={2} fill="#1f2937" />
          <rect x={0} y={-18} width={2} height={6} fill="#1f2937" />
        </g>
      ) : (
        // Crumbled wall blocks
        <g>
          <rect x={-12} y={-8} width={12} height={8} fill="#374151" />
          <rect x={-10} y={-8} width={2} height={8} fill="#4b5563" />
          <rect x={2} y={-6} width={10} height={6} fill="#374151" />
          <rect x={4} y={-12} width={8} height={6} fill="#4b5563" />
          <rect x={6} y={-12} width={2} height={6} fill="#9ca3af" />
        </g>
      )}
    </g>
  );
};

const EnvFlower: React.FC<{ sx: number; sy: number; variant: number }> = ({ sx, sy, variant }) => {
  const color = ['#ec4899', '#f59e0b', '#a855f7'][variant % 3];
  return (
    <g transform={`translate(${sx}, ${sy})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={2} rx={6} ry={2.5} fill="rgba(0,0,0,0.12)" />
      {/* Stem */}
      <rect x={-1} y={-8} width={2} height={8} fill="#22c55e" />
      {/* Petals (cross style) */}
      <rect x={-3} y={-12} width={6} height={5} fill={color} />
      <rect x={-1} y={-14} width={2} height={9} fill={color} />
      <rect x={-1} y={-11} width={2} height={2} fill="#fde68a" /> {/* center */}
    </g>
  );
};

// Environment layout (fixed positions, spread around edges/corners)
const ENV_ELEMENTS: { type: string; gx: number; gy: number; v: number }[] = [
  { type: 'tree',     gx: 4,  gy: 4,  v: 0 },
  { type: 'tree',     gx: 22, gy: 2,  v: 1 },
  { type: 'tree',     gx: 42, gy: 5,  v: 2 },
  { type: 'tree',     gx: 7,  gy: 30, v: 1 },
  { type: 'tree',     gx: 47, gy: 24, v: 0 },
  { type: 'tree',     gx: 48, gy: 10, v: 2 },
  { type: 'tree',     gx: 3,  gy: 16, v: 0 },
  { type: 'building', gx: 14, gy: 7,  v: 0 },
  { type: 'building', gx: 36, gy: 3,  v: 1 },
  { type: 'building', gx: 26, gy: 30, v: 2 },
  { type: 'rock',     gx: 24, gy: 20, v: 0 },
  { type: 'rock',     gx: 40, gy: 22, v: 0 },
  { type: 'rock',     gx: 10, gy: 24, v: 0 },
  { type: 'lamp',     gx: 18, gy: 14, v: 0 },
  { type: 'lamp',     gx: 32, gy: 18, v: 0 },
  { type: 'lamp',     gx: 10, gy: 10, v: 0 },

  // New additions for variety:
  { type: 'fountain', gx: 26, gy: 13, v: 0 },
  { type: 'bush',     gx: 5,  gy: 5,  v: 0 },
  { type: 'bush',     gx: 23, gy: 3,  v: 1 },
  { type: 'bush',     gx: 12, gy: 25, v: 0 },
  { type: 'bush',     gx: 41, gy: 23, v: 1 },
  { type: 'ruins',    gx: 15, gy: 32, v: 0 },
  { type: 'ruins',    gx: 45, gy: 6,  v: 1 },
  { type: 'flower',   gx: 17, gy: 13, v: 0 },
  { type: 'flower',   gx: 19, gy: 15, v: 1 },
  { type: 'flower',   gx: 31, gy: 17, v: 2 },
  { type: 'flower',   gx: 33, gy: 19, v: 0 },
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

  // Animation loop (throttled to ~30 FPS to prevent React scheduler starvation)
  useEffect(() => {
    let lastTime = 0;
    const tick = (time: number) => {
      // Run every ~33ms (30 FPS)
      if (time - lastTime >= 33) {
        lastTime = time;
        setChars(prev => prev.map(c => {
          if (c.drag) return { ...c, frame: c.frame + 1 };
          const dx = c.tx - c.x;
          const dy = c.ty - c.y;
          const dist = Math.hypot(dx, dy);
          let { x, y, tx, ty, frame, moving, idle, dir } = c;
          if (dist > 0.06) {
            // Speed multiplied by 2 to compensate for half the update frequency
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
    // Drag factors adjusted for current scale
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
    // If clicking overlays or panels, don't trigger panning
    const target = e.target as HTMLElement;
    if (target.closest('.no-pan')) return;

    if (dragId) return;

    // Track pointer
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
      // Handle multi-touch pinch to zoom
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
      // Normal drag panning
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

  // Grid lines pre-computed
  const vLines = useMemo(() => Array.from({ length: GRID_W + 1 }, (_, i) => {
    const a = g2s(i, 0);
    const b = g2s(i, GRID_H);
    return { x1: a.sx, y1: a.sy, x2: b.sx, y2: b.sy };
  }), []);
  const hLines = useMemo(() => Array.from({ length: GRID_H + 1 }, (_, i) => {
    const a = g2s(0, i);
    const b = g2s(GRID_W, i);
    return { x1: a.sx, y1: a.sy, x2: b.sx, y2: b.sy };
  }), []);

  // Hover stats details computed
  const hoveredChar = useMemo(() => chars.find(c => c.id === hoveredCharId), [chars, hoveredCharId]);
  const hoveredDesignerStats = useMemo(() => stats.find(s => s.id === hoveredCharId), [stats, hoveredCharId]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        overflow: 'hidden', position: 'relative',
        background: 'radial-gradient(ellipse at 50% 25%, #0d0f1f 0%, #060812 55%, #020408 100%)',
        cursor: panning ? 'grabbing' : dragId ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={onBgDown}
      onPointerMove={onBgMove}
      onPointerUp={onBgUp}
      onPointerLeave={onBgLeave}
    >
      {/* Stars */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {Array.from({ length: 100 }, (_, i) => {
          const r = ((i * 37 + 17) % 100) / 100;
          return (
            <rect key={i}
              x={`${(i * 79 + 13) % 100}%`} y={`${(i * 53 + 7) % 100}%`}
              width={r > 0.85 ? 2 : 1} height={r > 0.85 ? 2 : 1}
              fill="white" opacity={0.08 + r * 0.28}
            />
          );
        })}
      </svg>

      {/* World SVG */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
        <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
          {/* Grid tiles */}
          {Array.from({ length: GRID_H }, (_, gy) =>
            Array.from({ length: GRID_W }, (_, gx) => {
              const { sx, sy } = g2s(gx, gy);
              return <g key={`${gx}-${gy}`} transform={`translate(${sx}, ${sy})`}><IsoTile gx={gx} gy={gy} /></g>;
            })
          )}

          {/* Highlighted Tile */}
          {hoveredTile && (
            <g transform={`translate(${g2s(hoveredTile.gx, hoveredTile.gy).sx}, ${g2s(hoveredTile.gx, hoveredTile.gy).sy})`}>
              <polygon
                points={`0,0 ${TILE_W / 2},${TILE_H / 2} 0,${TILE_H} ${-TILE_W / 2},${TILE_H / 2}`}
                fill="rgba(99,102,241,0.22)"
                stroke="rgba(99,102,241,0.75)"
                strokeWidth="1.5"
                style={{ pointerEvents: 'none' }}
              />
            </g>
          )}

          {/* Grid lines */}
          {vLines.map((l, i) => <line key={`v${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(99,102,241,0.055)" strokeWidth="0.5" />)}
          {hLines.map((l, i) => <line key={`h${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(99,102,241,0.055)" strokeWidth="0.5" />)}

          {/* Environment + Characters (depth-sorted together) */}
          {(() => {
            // Merge env + chars into one depth-sorted list
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
                const baseY = sy;
                if (item.el.type === 'tree')     return <EnvTree     key={`e${idx}`} sx={sx} sy={baseY} variant={item.el.v} />;
                if (item.el.type === 'building') return <EnvBuilding key={`e${idx}`} sx={sx} sy={baseY} variant={item.el.v} />;
                if (item.el.type === 'rock')     return <EnvRock     key={`e${idx}`} sx={sx} sy={baseY} />;
                if (item.el.type === 'lamp')     return <EnvLamp     key={`e${idx}`} sx={sx} sy={baseY} />;
                if (item.el.type === 'bush')     return <EnvBush     key={`e${idx}`} sx={sx} sy={baseY} variant={item.el.v} />;
                if (item.el.type === 'fountain') return <EnvFountain key={`e${idx}`} sx={sx} sy={baseY} />;
                if (item.el.type === 'ruins')    return <EnvRuins    key={`e${idx}`} sx={sx} sy={baseY} variant={item.el.v} />;
                if (item.el.type === 'flower')   return <EnvFlower   key={`e${idx}`} sx={sx} sy={baseY} variant={item.el.v} />;
                return null;
              } else {
                const c = item.c;
                const { sx, sy } = g2s(c.x, c.y);
                const pal = PALETTES[c.pi];
                return (
                  <g
                    key={c.id}
                    transform={`translate(${sx}, ${sy - 4})`}
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
        const charScreenX = offset.x + sx * scale;
        const charScreenY = offset.y + (sy - 72) * scale;
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
              pointerEvents: 'none', // Allow cursor interactions to bleed through
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
