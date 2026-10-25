// Procedural character sprites. Anchor is at the feet. ~46px tall at s=1 (incl. placard).
(() => {
const PAL = {
  male:   { skin: '#b9794f', top: '#f3efe6', bottom: '#2b3b63', hair: '#1b1512' },
  female: { skin: '#c58a5e', top: '#f08a1c', bottom: '#fff4e0', hair: '#1b1512', extra: '#2f7d4f' },
  genz:   { skin: '#a86b45', top: '#7b4fd6', bottom: '#5b6b3a', hair: '#2ad1c4', extra: '#ff4fa3' },
  cop:    { skin: '#a8714a', top: '#b39457', bottom: '#9c7f45', hair: '#1b1512', extra: '#1f2f57' },
};
const GRAY = { skin: '#9a948a', top: '#bdb6aa', bottom: '#7d776d', hair: '#4a463f', extra: '#8a847a' };
function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
function drawChar(c, x, y, kind, o = {}) {
  const s = o.s || 1, sw = o.moving ? Math.sin(o.phase || 0) : 0;
  const p = Object.assign({}, o.gray ? GRAY : PAL[kind]);
  if (o.top && !o.gray) p.top = o.top;
  if (o.hairCol && !o.gray) p.hair = o.hairCol;
  const ink = '#1d1a16';
  c.save(); c.translate(x, y); c.scale(s, s);
  c.lineCap = 'round'; c.lineJoin = 'round';
  // shadow
  c.fillStyle = 'rgba(29,26,22,.28)'; c.beginPath(); c.ellipse(0, 0, 10, 3.2, 0, 0, 7); c.fill();
  // back hair (female)
  if (kind === 'female') { c.fillStyle = p.hair; rr(c, -7.2, -36, 14.4, 15, 6); c.fill(); }
  if (kind === 'genz') { c.fillStyle = p.top; rr(c, -7.5, -33, 15, 9, 5); c.fill(); } // hood behind
  // legs
  c.lineWidth = 4.2; c.strokeStyle = ink;
  c.beginPath(); c.moveTo(-3, -12); c.lineTo(-3 + sw * 3.2, -1); c.moveTo(3, -12); c.lineTo(3 - sw * 3.2, -1); c.stroke();
  c.lineWidth = 2.6; c.strokeStyle = p.bottom;
  c.beginPath(); c.moveTo(-3, -12); c.lineTo(-3 + sw * 3.2, -1.5); c.moveTo(3, -12); c.lineTo(3 - sw * 3.2, -1.5); c.stroke();
  c.fillStyle = ink; c.beginPath(); c.arc(-3 + sw * 3.2, -0.8, 1.8, 0, 7); c.arc(3 - sw * 3.2, -0.8, 1.8, 0, 7); c.fill();
  // torso
  c.lineWidth = 1.6; c.strokeStyle = ink;
  if (kind === 'male') { c.fillStyle = p.top; rr(c, -6.5, -24.5, 13, 16.5, 4); c.fill(); c.stroke(); c.strokeStyle = 'rgba(29,26,22,.35)'; c.beginPath(); c.moveTo(0, -24); c.lineTo(0, -18); c.stroke(); }
  else if (kind === 'female') {
    c.fillStyle = p.top; rr(c, -6.5, -24.5, 13, 15.5, 4); c.fill(); c.stroke();
    c.fillStyle = p.extra; c.beginPath(); c.moveTo(-6.5, -24); c.lineTo(-2.5, -24.5); c.lineTo(6.5, -13); c.lineTo(6.5, -10); c.closePath(); c.fill();
  } else if (kind === 'genz') {
    c.fillStyle = p.top; rr(c, -7, -24.5, 14, 13.5, 5); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.moveTo(-3.5, -15); c.lineTo(3.5, -15); c.stroke();
    c.fillStyle = '#fff'; c.font = '700 4px sans-serif'; c.textAlign = 'center'; c.fillText('Z', 0, -18);
  } else {
    c.fillStyle = p.top; rr(c, -6.8, -24.5, 13.6, 13.5, 3); c.fill(); c.stroke();
    c.fillStyle = '#4a3220'; c.fillRect(-6.8, -13.5, 13.6, 2.2);
    c.fillStyle = '#d9b44a'; c.fillRect(-1, -13.3, 2, 1.8);
    c.strokeStyle = 'rgba(29,26,22,.4)'; c.lineWidth = 1; c.strokeRect(-5, -21.5, 3.5, 3); c.strokeRect(1.5, -21.5, 3.5, 3);
    c.fillStyle = p.extra; c.fillRect(-6.8, -24.5, 3, 1.6); c.fillRect(3.8, -24.5, 3, 1.6);
  }
  // arms
  const armA = kind === 'cop' ? sw * 2 : 0;
  c.lineWidth = 4; c.strokeStyle = ink;
  c.beginPath(); c.moveTo(-6, -22); c.lineTo(-8.5 - sw * 1.5, -14 + armA); c.moveTo(6, -22); c.lineTo(o.placard ? 8 : 8.5 + sw * 1.5, o.placard ? -26 : -14 - armA); c.stroke();
  c.lineWidth = 2.4; c.strokeStyle = p.top;
  c.beginPath(); c.moveTo(-6, -22); c.lineTo(-8.5 - sw * 1.5, -14 + armA); c.moveTo(6, -22); c.lineTo(o.placard ? 8 : 8.5 + sw * 1.5, o.placard ? -26 : -14 - armA); c.stroke();
  c.fillStyle = p.skin; c.beginPath(); c.arc(-8.5 - sw * 1.5, -13.6 + armA, 1.7, 0, 7); c.fill();
  // props
  if (o.placard) {
    c.strokeStyle = '#6b4a24'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(8.5, -24); c.lineTo(9.5, -40); c.stroke();
    c.fillStyle = '#fffaf0'; c.strokeStyle = ink; c.lineWidth = 1.4; rr(c, 0, -48, 19, 10, 1.5); c.fill(); c.stroke();
    c.fillStyle = o.placardCol || '#c8321e'; c.fillRect(2.5, -45.5, 14, 2); c.fillRect(2.5, -42, 9, 2);
    c.fillStyle = p.skin; c.beginPath(); c.arc(8.3, -26.5, 1.7, 0, 7); c.fill();
  } else if (kind === 'cop') {
    c.strokeStyle = '#6b4a24'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(8.5, -14); c.lineTo(15, -27); c.stroke();
    c.fillStyle = p.skin; c.beginPath(); c.arc(8.7, -14, 1.7, 0, 7); c.fill();
  } else { c.fillStyle = p.skin; c.beginPath(); c.arc(8.5 + sw * 1.5, -13.6, 1.7, 0, 7); c.fill(); }
  if (kind === 'genz' && !o.gray) { c.fillStyle = '#1d1a16'; rr(c, -11, -18, 3.6, 5.6, 0.8); c.fill(); c.fillStyle = '#7ff3ea'; c.fillRect(-10.4, -17.3, 2.4, 4); }
  // head
  c.fillStyle = p.skin; c.strokeStyle = ink; c.lineWidth = 1.5; c.beginPath(); c.arc(0, -30.5, 6.4, 0, 7); c.fill(); c.stroke();
  c.fillStyle = ink; c.beginPath(); c.arc(-2.2, -30, 0.85, 0, 7); c.arc(2.2, -30, 0.85, 0, 7); c.fill();
  if (kind === 'male') {
    c.fillStyle = p.hair; c.beginPath(); c.arc(0, -31.2, 6.7, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); c.fill();
    c.fillRect(-2.6, -27.6, 5.2, 1.1);
  } else if (kind === 'female') {
    c.fillStyle = p.hair; c.beginPath(); c.arc(0, -31.4, 6.7, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); c.fill();
    c.fillStyle = '#c8321e'; c.beginPath(); c.arc(0, -33.2, 0.9, 0, 7); c.fill();
    c.fillStyle = p.hair; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(6.6, -26 + i * 3, 1.6, 0, 7); c.fill(); }
  } else if (kind === 'genz') {
    c.fillStyle = p.hair; c.beginPath(); c.moveTo(-6.5, -32); c.lineTo(-5, -39); c.lineTo(-2, -35.5); c.lineTo(0, -40.5); c.lineTo(2.2, -35.5); c.lineTo(5.2, -39); c.lineTo(6.5, -32); c.closePath(); c.fill();
    if (!o.gray) { c.strokeStyle = ink; c.lineWidth = 1.6; c.beginPath(); c.arc(0, -31, 8, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); c.fillStyle = p.extra; rr(c, -9.4, -32.5, 3.2, 5, 1.2); c.fill(); rr(c, 6.2, -32.5, 3.2, 5, 1.2); c.fill(); }
  } else {
    c.fillStyle = p.extra; c.beginPath(); c.ellipse(0.5, -35.4, 7.6, 3.4, -0.08, 0, 7); c.fill();
    c.fillRect(-6.5, -35, 13, 2.4); c.fillStyle = '#d9b44a'; c.beginPath(); c.arc(-2.5, -34.6, 1, 0, 7); c.fill();
    c.fillStyle = p.hair; c.fillRect(-2.8, -27.6, 5.6, 1.2);
  }
  c.restore();
}
window.drawChar = drawChar;
})();
