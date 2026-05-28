interface SectionHeadingProps {
  /** Small muted eyebrow line above the title */
  eyebrow?: string;
  title: string;
  /** Subtitle shown only on mobile (below title) */
  mobileSubtitle?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  mobileSubtitle,
}: SectionHeadingProps) {
  return (
    <div className="mb-4 md:mb-6">
      {eyebrow && (
        <p className="text-[#adadad] text-sm md:text-xl font-normal leading-none">
          {eyebrow}
        </p>
      )}
      <p className="font-inter font-medium text-2xl md:text-[38px] text-black tracking-[0.02em] leading-none mt-0.5">
        {title}
      </p>
      {mobileSubtitle && (
        <p className="mt-1 text-[#a7a7a7] text-sm leading-[1.4] md:hidden">
          {mobileSubtitle}
        </p>
      )}
    </div>
  );
}
