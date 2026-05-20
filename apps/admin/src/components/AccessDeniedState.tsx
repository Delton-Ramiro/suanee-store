interface AccessDeniedStateProps {
  title?: string;
  message: string;
}

export default function AccessDeniedState({
  title = "Sem acesso",
  message,
}: AccessDeniedStateProps) {
  return (
    <div className="bg-card rounded-lg border border-border-light px-6 py-8">
      <p className="text-base font-semibold text-primary font-lato">{title}</p>
      <p className="mt-2 text-sm text-text-body font-figtree">{message}</p>
    </div>
  );
}
