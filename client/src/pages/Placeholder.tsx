export function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-gray-3 bg-white p-8 text-center text-gray">
      <p className="text-lg font-medium text-navy">{title}</p>
      <p className="mt-1 text-sm">இந்தப் பக்கம் விரைவில் வரும்.</p>
    </div>
  );
}
