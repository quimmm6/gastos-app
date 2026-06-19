export default function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Q: cercle + cua diagonal */}
      <circle cx="17" cy="17" r="12.5" stroke="#818cf8" strokeWidth="2.8" />
      <line x1="25.5" y1="25.5" x2="33" y2="33" stroke="#818cf8" strokeWidth="2.8" strokeLinecap="round" />
      {/* Gràfic interior disimulat com a eix de la Q */}
      <polyline points="10,20 13.5,15 17,18 21,12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  )
}
