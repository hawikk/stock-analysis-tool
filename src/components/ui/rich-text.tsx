/** Renders `**bold**` spans from model/engine text without pulling in a markdown parser. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-fg">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}
