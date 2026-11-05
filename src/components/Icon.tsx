// ไอคอน Lucide (https://lucide.dev · ISC License) — ฝังเฉพาะไอคอนที่ใช้ ไม่ต้องติดตั้งแพ็กเกจเพิ่ม
import type { CSSProperties } from "react";

const P = {
  Crosshair: "<circle cx=\"12\" cy=\"12\" r=\"10\"/> <line x1=\"22\" x2=\"18\" y1=\"12\" y2=\"12\"/> <line x1=\"6\" x2=\"2\" y1=\"12\" y2=\"12\"/> <line x1=\"12\" x2=\"12\" y1=\"6\" y2=\"2\"/> <line x1=\"12\" x2=\"12\" y1=\"22\" y2=\"18\"/>",
  ScanSearch: "<path d=\"M3 7V5a2 2 0 0 1 2-2h2\"/> <path d=\"M17 3h2a2 2 0 0 1 2 2v2\"/> <path d=\"M21 17v2a2 2 0 0 1-2 2h-2\"/> <path d=\"M7 21H5a2 2 0 0 1-2-2v-2\"/> <circle cx=\"12\" cy=\"12\" r=\"3\"/> <path d=\"m16 16-1.9-1.9\"/>",
  CalendarDays: "<path d=\"M8 2v3\"/> <path d=\"M16 2v3\"/> <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/> <path d=\"M3 9h18\"/> <path d=\"M8 13h.01\"/> <path d=\"M12 13h.01\"/> <path d=\"M16 13h.01\"/> <path d=\"M8 17h.01\"/> <path d=\"M12 17h.01\"/> <path d=\"M16 17h.01\"/>",
  Sunrise: "<path d=\"M12 2v8\"/> <path d=\"m4.93 10.93 1.41 1.41\"/> <path d=\"M2 18h2\"/> <path d=\"M20 18h2\"/> <path d=\"m19.07 10.93-1.41 1.41\"/> <path d=\"M22 22H2\"/> <path d=\"m8 6 4-4 4 4\"/> <path d=\"M16 18a4 4 0 0 0-8 0\"/>",
  Sun: "<circle cx=\"12\" cy=\"12\" r=\"4\"/> <path d=\"M12 2v2\"/> <path d=\"M12 20v2\"/> <path d=\"m4.93 4.93 1.41 1.41\"/> <path d=\"m17.66 17.66 1.41 1.41\"/> <path d=\"M2 12h2\"/> <path d=\"M20 12h2\"/> <path d=\"m6.34 17.66-1.41 1.41\"/> <path d=\"m19.07 4.93-1.41 1.41\"/>",
  Sunset: "<path d=\"M12 10V2\"/> <path d=\"m4.93 10.93 1.41 1.41\"/> <path d=\"M2 18h2\"/> <path d=\"M20 18h2\"/> <path d=\"m19.07 10.93-1.41 1.41\"/> <path d=\"M22 22H2\"/> <path d=\"m16 6-4 4-4-4\"/> <path d=\"M16 18a4 4 0 0 0-8 0\"/>",
  KeyRound: "<path d=\"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z\"/> <circle cx=\"16.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"/>",
  Stethoscope: "<path d=\"M11 2v2\"/> <path d=\"M5 2v2\"/> <path d=\"M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1\"/> <path d=\"M8 15a6 6 0 0 0 12 0v-3\"/> <circle cx=\"20\" cy=\"10\" r=\"2\"/>",
  Clock: "<circle cx=\"12\" cy=\"12\" r=\"10\"/> <path d=\"M12 6v6l4 2\"/>",
  CalendarRange: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/> <path d=\"M16 2v3\"/> <path d=\"M3 9h18\"/> <path d=\"M8 2v3\"/> <path d=\"M17 13h-6\"/> <path d=\"M13 17H7\"/> <path d=\"M7 13h.01\"/> <path d=\"M17 17h.01\"/>",
  CalendarX: "<path d=\"M8 2v3\"/> <path d=\"M16 2v3\"/> <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/> <path d=\"M3 9h18\"/> <path d=\"m14 13-4 4\"/> <path d=\"m10 13 4 4\"/>",
  Settings: "<path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/> <circle cx=\"12\" cy=\"12\" r=\"3\"/>",
  LogOut: "<path d=\"m16 17 5-5-5-5\"/> <path d=\"M21 12H9\"/> <path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"/>",
  ChartColumn: "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\"/> <path d=\"M18 17V9\"/> <path d=\"M13 17V5\"/> <path d=\"M8 17v-3\"/>",
  Repeat: "<path d=\"m17 2 4 4-4 4\"/> <path d=\"M3 11v-1a4 4 0 0 1 4-4h14\"/> <path d=\"m7 22-4-4 4-4\"/> <path d=\"M21 13v1a4 4 0 0 1-4 4H3\"/>",
  ChevronLeft: "<path d=\"m15 18-6-6 6-6\"/>",
  ChevronRight: "<path d=\"m9 18 6-6-6-6\"/>",
  ZoomIn: "<circle cx=\"11\" cy=\"11\" r=\"8\"/> <line x1=\"21\" x2=\"16.65\" y1=\"21\" y2=\"16.65\"/> <line x1=\"11\" x2=\"11\" y1=\"8\" y2=\"14\"/> <line x1=\"8\" x2=\"14\" y1=\"11\" y2=\"11\"/>",
  Scan: "<path d=\"M3 7V5a2 2 0 0 1 2-2h2\"/> <path d=\"M17 3h2a2 2 0 0 1 2 2v2\"/> <path d=\"M21 17v2a2 2 0 0 1-2 2h-2\"/> <path d=\"M7 21H5a2 2 0 0 1-2-2v-2\"/>",
  Maximize2: "<path d=\"M15 3h6v6\"/> <path d=\"m21 3-7 7\"/> <path d=\"m3 21 7-7\"/> <path d=\"M9 21H3v-6\"/>",
  Download: "<path d=\"M12 15V3\"/> <path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/> <path d=\"m7 10 5 5 5-5\"/>",
  RotateCcw: "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"/> <path d=\"M3 3v5h5\"/>",
  Palette: "<path d=\"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z\"/> <circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\"/> <circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\"/> <circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\"/> <circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"/>",
  Paintbrush: "<path d=\"m14.622 17.897-10.68-2.913\"/> <path d=\"M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z\"/> <path d=\"M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15\"/>",
  Eraser: "<path d=\"M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21\"/> <path d=\"m5.082 11.09 8.828 8.828\"/>",
  Search: "<path d=\"m21 21-4.34-4.34\"/> <circle cx=\"11\" cy=\"11\" r=\"8\"/>",
  X: "<path d=\"M18 6 6 18\"/> <path d=\"m6 6 12 12\"/>",
  Check: "<path d=\"M20 6 9 17l-5-5\"/>",
  Save: "<path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\"/> <path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7\"/> <path d=\"M7 3v4a1 1 0 0 0 1 1h7\"/>",
  TriangleAlert: "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/> <path d=\"M12 9v4\"/> <path d=\"M12 17h.01\"/>",
  Info: "<circle cx=\"12\" cy=\"12\" r=\"10\"/> <path d=\"M12 16v-4\"/> <path d=\"M12 8h.01\"/>",
  CircleCheck: "<circle cx=\"12\" cy=\"12\" r=\"10\"/> <path d=\"m16 9-5.5 5.5L8 12\"/>",
  CircleX: "<circle cx=\"12\" cy=\"12\" r=\"10\"/> <path d=\"m15 9-6 6\"/> <path d=\"m9 9 6 6\"/>",
  LoaderCircle: "<path d=\"M21 12a9 9 0 1 1-6.219-8.56\"/>",
  Eye: "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/> <circle cx=\"12\" cy=\"12\" r=\"3\"/>",
  EyeOff: "<path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49\"/> <path d=\"M14.084 14.158a3 3 0 0 1-4.242-4.242\"/> <path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143\"/> <path d=\"m2 2 20 20\"/>",
  LockKeyhole: "<circle cx=\"12\" cy=\"16\" r=\"1\"/> <rect x=\"3\" y=\"10\" width=\"18\" height=\"12\" rx=\"2\"/> <path d=\"M7 10V7a5 5 0 0 1 10 0v3\"/>",
  User: "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"/> <circle cx=\"12\" cy=\"7\" r=\"4\"/>",
  Users: "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/> <path d=\"M16 3.128a4 4 0 0 1 0 7.744\"/> <path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/> <circle cx=\"9\" cy=\"7\" r=\"4\"/>",
  Plus: "<path d=\"M5 12h14\"/> <path d=\"M12 5v14\"/>",
  Trash: "<path d=\"M10 11v6\"/> <path d=\"M14 11v6\"/> <path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\"/> <path d=\"M3 6h18\"/> <path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>",
  ArrowUpDown: "<path d=\"m21 16-4 4-4-4\"/> <path d=\"M17 20V4\"/> <path d=\"m3 8 4-4 4 4\"/> <path d=\"M7 4v16\"/>",
  Undo2: "<path d=\"M9 14 4 9l5-5\"/> <path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\"/>",
  Sparkles: "<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\"/> <path d=\"M20 2v4\"/> <path d=\"M22 4h-4\"/> <circle cx=\"4\" cy=\"20\" r=\"2\"/>",
  ShieldCheck: "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\"/> <path d=\"m9 12 2 2 4-4\"/>",
  CalendarClock: "<path d=\"M16 14v2.2l1.6 1\"/> <path d=\"M16 2v3\"/> <path d=\"M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338\"/> <path d=\"M3 9h5.859\"/> <path d=\"M8 2v3\"/> <circle cx=\"16\" cy=\"16\" r=\"6\"/>",
  ListChecks: "<path d=\"M13 5h8\"/> <path d=\"M13 12h8\"/> <path d=\"M13 19h8\"/> <path d=\"m3 17 2 2 4-4\"/> <path d=\"m3 7 2 2 4-4\"/>",
  FileDown: "<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\"/> <path d=\"M14 2v5a1 1 0 0 0 1 1h5\"/> <path d=\"M12 18v-6\"/> <path d=\"m9 15 3 3 3-3\"/>",
  MousePointerClick: "<path d=\"M14 4.1 12 6\"/> <path d=\"m5.1 8-2.9-.8\"/> <path d=\"m6 12-1.9 2\"/> <path d=\"M7.2 2.2 8 5.1\"/> <path d=\"M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z\"/>",
  Droplets: "<path d=\"M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z\"/> <path d=\"M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97\"/>",
  Syringe: "<path d=\"m18 2 4 4\"/> <path d=\"m17 7 3-3\"/> <path d=\"M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5\"/> <path d=\"m9 11 4 4\"/> <path d=\"m5 19-3 3\"/> <path d=\"m14 4 6 6\"/>",
  TestTubeDiagonal: "<path d=\"M21 7 6.82 21.18a2.83 2.83 0 0 1-3.99-.01a2.83 2.83 0 0 1 0-4L17 3\"/> <path d=\"m16 2 6 6\"/> <path d=\"M12 16H4\"/>",
  Type: "<path d=\"M12 4v16\"/> <path d=\"M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2\"/> <path d=\"M9 20h6\"/>",
  PencilLine: "<path d=\"M13 21h8\"/> <path d=\"m15 5 4 4\"/> <path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"/>",
  ArrowDownAZ: "<path d=\"m3 16 4 4 4-4\"/> <path d=\"M7 20V4\"/> <path d=\"M20 8h-5\"/> <path d=\"M15 10V6.5a2.5 2.5 0 0 1 5 0V10\"/> <path d=\"M15 14h5l-5 6h5\"/>",
  Timer: "<line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\"/> <line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\"/> <circle cx=\"12\" cy=\"14\" r=\"8\"/>",
  CalendarPlus: "<path d=\"M16 18h6\"/> <path d=\"M16 2v3\"/> <path d=\"M19 15v6\"/> <path d=\"M21 11.5V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h8.3\"/> <path d=\"M3 9h18\"/> <path d=\"M8 2v3\"/>",
  HeartPulse: "<path d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\"/> <path d=\"M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27\"/>",
  Building: "<path d=\"M12 10h.01\"/> <path d=\"M12 14h.01\"/> <path d=\"M12 6h.01\"/> <path d=\"M16 10h.01\"/> <path d=\"M16 14h.01\"/> <path d=\"M16 6h.01\"/> <path d=\"M8 10h.01\"/> <path d=\"M8 14h.01\"/> <path d=\"M8 6h.01\"/> <path d=\"M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3\"/> <rect x=\"4\" y=\"2\" width=\"16\" height=\"20\" rx=\"2\"/>",
  LayoutGrid: "<rect width=\"7\" height=\"7\" x=\"3\" y=\"3\" rx=\"1\"/> <rect width=\"7\" height=\"7\" x=\"14\" y=\"3\" rx=\"1\"/> <rect width=\"7\" height=\"7\" x=\"14\" y=\"14\" rx=\"1\"/> <rect width=\"7\" height=\"7\" x=\"3\" y=\"14\" rx=\"1\"/>",
  CalendarCheck: "<path d=\"M8 2v3\"/> <path d=\"M16 2v3\"/> <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/> <path d=\"M3 9h18\"/> <path d=\"m9 15 2 2 4-4\"/>",
  Grid3x3: "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/> <path d=\"M3 9h18\"/> <path d=\"M3 15h18\"/> <path d=\"M9 3v18\"/> <path d=\"M15 3v18\"/>",
  SquarePen: "<path d=\"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/> <path d=\"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z\"/>",
  Hospital: "<path d=\"M12 7v4\"/> <path d=\"M14 21v-3a2 2 0 0 0-4 0v3\"/> <path d=\"M14 9h-4\"/> <path d=\"M18 11h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2\"/> <path d=\"M18 21V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16\"/>",
  Redo2: "<path d=\"m15 14 5-5-5-5\"/> <path d=\"M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13\"/>",
  Keyboard: "<path d=\"M10 8h.01\"/> <path d=\"M12 12h.01\"/> <path d=\"M14 8h.01\"/> <path d=\"M16 12h.01\"/> <path d=\"M18 8h.01\"/> <path d=\"M6 8h.01\"/> <path d=\"M7 16h10\"/> <path d=\"M8 12h.01\"/> <rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\"/>",
  CircleAlert: "<circle cx=\"12\" cy=\"12\" r=\"10\"/> <line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\"/> <line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\"/>",
} as const;

export type IconName = keyof typeof P;

export default function Icon({ name, size = 18, className, style, strokeWidth = 2 }: { name: IconName; size?: number; className?: string; style?: CSSProperties; strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `lucide ${className}` : "lucide"}
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: P[name] }}
    />
  );
}
