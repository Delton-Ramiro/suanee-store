import { ChevronRight } from "lucide-react";

interface CardOverlayLabelProps {
  name: string;
}

/** Gradient overlay + name + chevron — shared by category and collection cards */
export function CardOverlayLabel({ name }: CardOverlayLabelProps) {
  return (
    <>
      <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/5 to-transparent" />
      <div className="absolute bottom-3 left-4 sm:bottom-4 sm:left-5 xl:bottom-6 xl:left-6 flex items-center gap-1.5">
        <span className="font-medium leading-none text-white text-h6 sm:text-h6 md:text-h5 lg:text-h4 xl:text-h3">
          {name}
        </span>
        <ChevronRight className="shrink-0 text-white w-3.5 h-3.5 md:w-4 md:h-4 xl:w-5 xl:h-5 mt-px" />
      </div>
    </>
  );
}
