export function BrandMark({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      width={size}
      height={size}
    >
      <rect x="4" y="4" width="40" height="40" rx="13" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M31 14.5c-3.2 0-4.4 2-5 5.3l-2.4 8.4c-.6 3.3-1.8 5.3-5 5.3"
        stroke="var(--primary-solid)"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="31" cy="14.5" r="2" fill="var(--primary-solid)" />
      <circle cx="18.6" cy="33.5" r="2" fill="var(--primary-solid)" />
    </svg>
  );
}
