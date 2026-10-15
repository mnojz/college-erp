import { PublicLayout } from "@/app/components/layout/PublicLayout";
import { IconBarrierBlock } from "@tabler/icons-react";

export default function FeeStructurePage() {
  return (
    <PublicLayout>
      <div className="mx-auto flex min-h-[65vh] max-w-5xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 sm:py-24">
        <div className="mb-6 flex size-20 sm:size-24 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-xs">
          <IconBarrierBlock className="size-10 sm:size-12" />
        </div>
        <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tight text-foreground uppercase">
          Under Development
        </h1>
      </div>
    </PublicLayout>
  );
}