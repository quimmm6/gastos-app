export default function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="15" cy="15" r="11" stroke="#818cf8" strokeWidth="2.6" />
      <line x1="20" y1="20" x2="30" y2="30" stroke="#818cf8" strokeWidth="3" strokeLinecap="round" />
      <polyline points="9,18 12,13 15,16 19,10" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  )
}
