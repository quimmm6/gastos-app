import sharp from 'sharp'

const svgIcon = (size) => {
  const s = size
  // Scale factors from 40x40 viewBox to s×s
  const k = s / 40
  const cx = 17 * k, cy = 17 * k, r = 12.5 * k
  const sw = 2.8 * k
  const sw2 = 3.2 * k
  const sw3 = 2 * k
  // Q tail: from (19,19) to (33,33)
  const tx1 = 19*k, ty1 = 19*k, tx2 = 33*k, ty2 = 33*k
  // Chart polyline: 10,20 13.5,15 17,18 21,12
  const pts = [[10,20],[13.5,15],[17,18],[21,12]].map(([x,y]) => `${x*k},${y*k}`).join(' ')
  // Padding so stroke doesn't clip
  const pad = 4 * k

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
  <circle cx="${cx}" cy="${cy}" r="${r}" stroke="#818cf8" stroke-width="${sw}" fill="none"/>
  <!-- Q tail (starts inside circle) -->
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
