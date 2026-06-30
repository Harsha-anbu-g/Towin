import { LiquidButton } from "@/components/ui/liquid-glass-button";

export default function LiquidGlassButtonDemo() {
  return (
    <div className="relative h-[200px] w-full max-w-[800px]">
      <LiquidButton className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        Liquid Glass
      </LiquidButton>
    </div>
  );
}
