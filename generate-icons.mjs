import sharp from 'sharp'

const svgIcon = (size) => {
  const s = size
  // Scale factors from 40x40 viewBox to s×s
  const k = s / 40
  const cx = 17 * k, cy = 17 * k, r = 12.5 * k
  const sw = 2.8 * k
  const sw2 = 3.2 * k
  const sw3 = 2 * k
  // Q: slightly smaller, centered — shift centre to (18,17), r=11
  const qk = s / 40
  const qcx = 17 * qk, qcy = 16 * qk, qr = 11 * qk
  // Q tail: starts just inside circle boundary (22,22) → (32,32)
  const tx1 = 22*qk, ty1 = 21*qk, tx2 = 32*qk, ty2 = 31*qk
  // Chart polyline (scaled with Q)
  const pts = [[10,19],[13.5,14],[17,17],[21,11]].map(([x,y]) => `${x*qk},${y*qk}`).join(' ')

  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
  <!-- Dark background -->
  <rect width="${s}" height="${s}" rx="${s * 0.22}" fill="#1a1a24"/>
  <!-- Subtle radial glow -->
  <radialGradient id="g" cx="42%" cy="42%" r="55%">
    <stop offset="0%" stop-color="#6366f1" stop-opacity="0.18"/>
    <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
  </radialGradient>
  <rect width="${s}" height="${s}" rx="${s * 0.22}" fill="url(#g)"/>
  <!-- Q circle -->
  <circle cx="${qcx}" cy="${qcy}" r="${qr}" stroke="#818cf8" stroke-width="${sw}" fill="none"/>
  <!-- Q tail -->
  <line x1="${tx1}" y1="${ty1}" x2="${tx2}" y2="${ty2}" stroke="#818cf8" stroke-width="${sw2}" stroke-linecap="round"/>
  <!-- Chart inside -->
  <polyline points="${pts}" stroke="white" stroke-width="${sw3}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" fill="none"/>
</svg>`
}

for (const size of [192, 512]) {
  await sharp(Buffer.from(svgIcon(size)))
    .png()
    .toFile(`public/icon-${size}.png`)
  console.log(`✓ icon-${size}.png`)
}
