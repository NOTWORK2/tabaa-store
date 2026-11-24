function Petals() {
  return Array.from({ length: 8 }, (_, i) => (
    <path key={i} transform={`rotate(${i * 45} 24 24)`}
      d="M24 2.4 29.4 8 27.9 16.1 24 20.2 20.1 16.1 18.6 8Z M24 8.4 22.5 11.1 24 15.2 25.5 11.1Z"
      fill="currentColor" fillRule="evenodd" />
  ));
}

export function StudioMark({ size = 34 }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true"><Petals /><path d="m24 20 4 4-4 4-4-4Z" fill="currentColor" /></svg>;
}

export function StudioSeal() {
  return (
    <svg className="studio-seal" viewBox="0 0 110 110" aria-hidden="true" dir="ltr">
      <defs><path id="seal-type" d="M55 55m-37 0a37 37 0 1 1 74 0a37 37 0 1 1-74 0" /></defs>
      <circle cx="55" cy="55" r="52" className="seal-paper" />
      <circle cx="55" cy="55" r="48" fill="none" stroke="currentColor" strokeWidth=".8" />
      <circle cx="55" cy="55" r="32" fill="none" stroke="currentColor" strokeWidth=".65" />
      <text direction="ltr" unicodeBidi="bidi-override" fontFamily="Georgia, serif" fontSize="9.6" letterSpacing="1.1" fill="currentColor">
        <textPath href="#seal-type" textLength="231">TABAA PRINT STUDIO · TABAA PRINT STUDIO · </textPath>
      </text>
      <g transform="translate(33 33) scale(.9167)"><Petals /><circle cx="24" cy="24" r="2.7" fill="currentColor" /></g>
    </svg>
  );
}
