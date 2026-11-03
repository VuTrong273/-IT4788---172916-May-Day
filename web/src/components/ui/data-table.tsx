import type { ReactNode } from 'react';

export type DataColumn<Row> = {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  className?: string;
};

export function DataTable<Row>({ rows, columns, rowKey }: {
  rows: Row[];
  columns: DataColumn<Row>[];
  rowKey: (row: Row) => string | number;
}) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead><tr>{columns.map((column) => <th className={column.className} key={column.key}>{column.header}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={rowKey(row)}>{columns.map((column) => <td className={column.className} key={column.key}>{column.render(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
