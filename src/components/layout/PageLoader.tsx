import { Loader2 } from "lucide-react";

export default function PageLoader() {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Đang tải...</p>
    </div>
  );
}
