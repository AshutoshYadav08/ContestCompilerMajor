import { ReactNode } from "react";

type IconProps = {
  className?: string;
  size?: number;
};

function BaseIcon({ children, className = "", size = 18 }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-6h6v6" /></BaseIcon>;
}
export function UserIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="8" r="4" /></BaseIcon>;
}
export function UsersIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></BaseIcon>;
}
export function TrophyIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v4a5 5 0 0 1-10 0Z" /><path d="M17 5h3a2 2 0 0 1 0 4h-3" /><path d="M7 5H4a2 2 0 1 0 0 4h3" /></BaseIcon>;
}
export function PlusIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M12 5v14" /><path d="M5 12h14" /></BaseIcon>;
}
export function CalendarIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></BaseIcon>;
}
export function ClockIcon(props: IconProps) {
  return <BaseIcon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v6l4 2" /></BaseIcon>;
}
export function ShieldIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M12 3l7 3v5c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-3Z" /></BaseIcon>;
}
export function ArrowRightIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></BaseIcon>;
}
export function ArrowLeftIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M19 12H5" /><path d="m11 19-7-7 7-7" /></BaseIcon>;
}
export function SearchIcon(props: IconProps) {
  return <BaseIcon {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></BaseIcon>;
}
export function AlertIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /></BaseIcon>;
}
export function CheckCircleIcon(props: IconProps) {
  return <BaseIcon {...props}><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-4" /></BaseIcon>;
}
export function FolderIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></BaseIcon>;
}
export function LayoutIcon(props: IconProps) {
  return <BaseIcon {...props}><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></BaseIcon>;
}
export function BookIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></BaseIcon>;
}
export function SparklesIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="m12 3 1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3Z" /><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" /><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" /></BaseIcon>;
}
export function CopyIcon(props: IconProps) {
  return <BaseIcon {...props}><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></BaseIcon>;
}
