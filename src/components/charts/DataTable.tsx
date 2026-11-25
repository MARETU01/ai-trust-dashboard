import type { ChartTable } from '../../chart-types.ts';
import type { Translate } from '../../i18n.ts';

export default function DataTable({ title, table, t }: { title: string; table: ChartTable; t: Translate }) {
  return (
    <div className="data-table" tabIndex={0} aria-label={t('{title} data table', { title })}>
      <table>
        <thead><tr>{table.headers.map((name) => <th key={name} scope="col">{name}</th>)}</tr></thead>
        <tbody>
          {table.rows.map(([name, ...values]) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              {values.map((value, i) => <td key={table.headers[i + 1]}>{value}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
