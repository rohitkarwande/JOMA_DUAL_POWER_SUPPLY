import React from 'react';

interface JomaLogoProps {
  className?: string;
  height?: number;
}

export const JomaLogo: React.FC<JomaLogoProps> = ({ className = '', height = 36 }) => {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <svg
        height={height}
        viewBox="0 0 280 70"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-auto h-full"
      >
        {/* Letter J */}
        <path
          d="M 12 18 L 26 18 L 26 46 C 26 54 20 60 10 60 L 4 60 L 4 48 L 8 48 C 11 48 13 46 13 42 L 13 18 Z"
          fill="#0284C7"
        />

        {/* Letter O with Lightning Bolt cutout */}
        <circle cx="56" cy="38" r="21" fill="#0284C7" />
        <circle cx="56" cy="38" r="11" fill="#FFFFFF" />

        {/* Lightning Bolt over/inside O */}
        <path
          d="M 62 14 L 47 38 L 56 38 L 49 62 L 67 36 L 57 36 Z"
          fill="#F97316"
          stroke="#FFFFFF"
          strokeWidth="1.5"
        />

        {/* Letter M */}
        <path
          d="M 85 18 L 99 18 L 108 42 L 117 18 L 131 18 L 131 60 L 118 60 L 118 32 L 108 56 L 98 56 L 88 32 L 88 60 L 75 60 L 75 18 L 85 18 Z"
          fill="#0284C7"
        />

        {/* Letter A */}
        <path
          d="M 148 18 L 163 18 L 176 60 L 162 60 L 159 49 L 142 49 L 139 60 L 126 60 Z M 156 38 L 151 25 L 145 38 Z"
          fill="#0284C7"
        />

        {/* Subtitle Accent Lines */}
        <line x1="5" y1="65" x2="120" y2="65" stroke="#38BDF8" strokeWidth="2" />
        <line x1="5" y1="68" x2="120" y2="68" stroke="#F97316" strokeWidth="1.5" />

        {/* Subtitle: Next Gen Power */}
        <text
          x="130"
          y="67"
          fontFamily="'Segoe UI', Roboto, sans-serif"
          fontSize="14"
          fontStyle="italic"
          fontWeight="600"
          fill="#475569"
        >
          Next Gen Power
        </text>
      </svg>
    </div>
  );
};
