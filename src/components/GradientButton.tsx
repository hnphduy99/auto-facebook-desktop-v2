import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export const GradientButton = (props: React.ComponentProps<typeof Button>) => {
  return <Button {...props} className={cn("gradient-background border-none text-white", props.className)} size="lg" />;
};
