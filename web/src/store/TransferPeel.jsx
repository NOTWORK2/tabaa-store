// The viewBox matches the source photograph so the carrier stays on the chest at every crop.
export default function TransferPeel() {
  return (
    <svg className="campaign-transfer" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid slice"
      aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="carrier-film" x1="0" y1="0" x2="1" y2=".75">
          <stop stopColor="#fff5db" stopOpacity=".54" />
          <stop offset=".35" stopColor="#f4e9d2" stopOpacity=".76" />
          <stop offset=".53" stopColor="#fffdf0" stopOpacity=".88" />
          <stop offset=".66" stopColor="#f4e6c9" stopOpacity=".64" />
          <stop offset="1" stopColor="#e6d8bd" stopOpacity=".5" />
        </linearGradient>
        <linearGradient id="carrier-fold" gradientUnits="userSpaceOnUse" x1="0" y1="412" x2="10" y2="463">
          <stop stopColor="#877355" stopOpacity=".16" />
          <stop offset=".32" stopColor="#e3d6bc" />
          <stop offset=".79" stopColor="#fffaec" />
          <stop offset="1" stopColor="#d3c1a3" />
        </linearGradient>
        <clipPath id="carrier-sheet"><rect width="354" height="381" rx="5" /></clipPath>
        <clipPath id="carrier-contact">
          <path className="carrier-travel" d="M-60-700H440V386L-60 486Z" />
        </clipPath>
      </defs>
      <g transform="translate(506 233) rotate(-3 177 190)" clipPath="url(#carrier-sheet)">
        <g clipPath="url(#carrier-contact)">
          <rect x="1" y="1" width="352" height="379" rx="5" fill="url(#carrier-film)" stroke="#fff5dd" strokeOpacity=".8" strokeWidth="2" />
          <path d="M14 35V15h20m286 0h20v20M14 346v20h20m286 0h20v-20"
            fill="none" stroke="#775b45" strokeOpacity=".65" strokeWidth="2" />
        </g>
        <g className="carrier-travel">
          <path d="M-50 483 420 389" fill="none" stroke="#60492f" opacity=".13" strokeWidth="12" />
          <path d="M-50 447Q160 419 420 332V390L-50 484Z" fill="url(#carrier-fold)" />
          <path d="M-50 484 420 390" fill="none" stroke="#fffbed" strokeWidth="2" />
        </g>
      </g>
    </svg>
  );
}
