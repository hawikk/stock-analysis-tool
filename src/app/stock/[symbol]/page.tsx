import { Suspense } from "react";
import { StockView } from "@/components/stock/stock-view";
import { Skeleton } from "@/components/ui/states";

export default function StockPage({ params }: PageProps<"/stock/[symbol]">) {
  return (
    <Suspense fallback={<StockSkeleton />}>
      <StockView params={params} />
    </Suspense>
  );
}

function StockSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-[480px] w-full" />
    </div>
  );
}
