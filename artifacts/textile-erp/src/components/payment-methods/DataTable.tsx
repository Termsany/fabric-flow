interface DataTableProps {
  children: React.ReactNode;
  minWidth?: string;
}

export function DataTable({ children, minWidth = "960px" }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}
