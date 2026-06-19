export default function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Q: cercle */}
      <circle cx="17" cy="17" r="12.5" stroke="#818cf8" strokeWidth="2.8" />
      {/* Q: pal que comença dins del cercle i surt cap a baix-dreta */}
      <line x1="22" y1="22" x2="33" y2="33" stroke="#818cf8" strokeWidth="3.2" strokeLinecap="round" />
      {/* Gràfic interior */}
      <polyline points="10,20 13.5,15 17,18 21,12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  )
}
