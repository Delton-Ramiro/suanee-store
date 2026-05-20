export type TableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  render: (item: T, index: number) => React.ReactNode;
};

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
}

export default function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  loading,
  emptyMessage = "Nenhum resultado encontrado.",
}: DataTableProps<T>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-max min-w-full border-collapse">
        <thead>
          <tr className="bg-navy rounded-md">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 first:rounded-l-md last:rounded-r-md text-left text-sm font-medium text-white font-figtree whitespace-nowrap ${col.headerClassName ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <>
              {Array.from({ length: 6 }).map((_, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-b border-border-light last:border-b-0"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${col.className ?? ""}`}
                    >
                      <div
                        className="skeleton h-4 rounded"
                        style={{
                          width: `${60 + ((rowIdx * 13 + col.key.length * 7) % 30)}%`,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-10 text-center text-text-muted text-sm"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((item, index) => (
              <tr
                key={keyExtractor(item)}
                className="border-b border-border-light last:border-b-0 hover:bg-surface-hover transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-sm text-text-dark font-figtree ${col.className ?? ""}`}
                  >
                    {col.render(item, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
