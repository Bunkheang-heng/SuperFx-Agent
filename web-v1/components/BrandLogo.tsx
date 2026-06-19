import Image from "next/image";

export function BrandLogo({
  size = 44,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/logo/logo.png"
      alt="ThinkTrade"
      width={size}
      height={size}
      className={`rounded-xl object-contain ${className}`}
      priority
    />
  );
}
