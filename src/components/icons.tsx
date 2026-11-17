import {
  Headphones,
  Smartphone,
  Keyboard,
  Gamepad2,
  Monitor,
  Wifi,
} from "lucide-react";
const icons = {
  audio: Headphones,
  celulares: Smartphone,
  perifericos: Keyboard,
  gaming: Gamepad2,
  computo: Monitor,
  redes: Wifi,
};
export function CategoryIcon({
  slug,
  size = 28,
}: {
  slug: string;
  size?: number;
}) {
  const Icon = icons[slug as keyof typeof icons] ?? Monitor;
  return <Icon size={size} strokeWidth={1.5} />;
}
