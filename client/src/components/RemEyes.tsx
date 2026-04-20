import { useRemCursor } from "@/hooks/use-rem-cursor";

interface RemEyesProps {
  imageSrc: string;
  className?: string;
  maxOffset?: number;
}

export default function RemEyes({
  imageSrc,
  className,
  maxOffset = 5,
}: RemEyesProps) {
  const cursor = useRemCursor();
  const targetX = (cursor.x - 0.5) * 2 * maxOffset;
  const targetY = (cursor.y - 0.5) * 2 * maxOffset * 0.6;

  return (
    <div
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        border: "1px solid rgba(147,197,253,0.35)",
        boxShadow: "0 0 14px rgba(80,140,255,0.2)",
        borderRadius: 2,
      }}
    >
      <img
        src={imageSrc}
        alt="Rem eyes"
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        className="w-full h-full object-cover"
        style={{
          filter: "saturate(1.05) contrast(1.04)",
          transform: `translate(${targetX * -0.16}px, ${targetY * -0.14}px) scale(1.055)`,
          userSelect: "none",
          WebkitUserDrag: "none",
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(148,197,255,0.16) 0%, rgba(148,197,255,0.02) 38%, rgba(8,20,44,0.07) 100%)",
        }}
      />

      {cursor.enabled && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${Math.round(cursor.x * 100)}% ${Math.round(cursor.y * 100)}%, rgba(191,219,254,0.22), rgba(191,219,254,0) 44%)`,
          }}
        />
      )}
    </div>
  );
}
