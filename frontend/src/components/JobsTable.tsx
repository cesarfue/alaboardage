import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Job } from '@/lib/types'

const columns: ColumnDef<Job>[] = [
  {
    accessorKey: 'title',
    header: 'Titre',
    size: 380,
  },
  {
    accessorKey: 'company',
    header: 'Société',
    size: 220,
  },
  {
    accessorKey: 'location',
    header: 'Lieu',
    size: 200,
  },
  {
    accessorKey: 'source',
    header: 'Source',
    size: 110,
    cell: ({ getValue }) => (
      <span className="text-xs px-2 py-0.5 rounded bg-muted">
        {String(getValue())}
      </span>
    ),
  },
  {
    accessorKey: 'datePosted',
    header: 'Date',
    size: 130,
    cell: ({ getValue }) =>
      new Date(getValue() as string).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
  },
]

interface Props {
  jobs: Job[]
}

export function JobsTable({ jobs }: Props) {
  const navigate = useNavigate()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'datePosted', desc: true },
  ])

  const table = useReactTable({
    data: jobs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Table
      style={{ tableLayout: 'fixed', width: table.getTotalSize() }}
      className="max-w-full"
    >
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => {
              const sorted = h.column.getIsSorted()
              return (
                <TableHead
                  key={h.id}
                  style={{ width: h.getSize() }}
                  className="cursor-pointer select-none overflow-hidden"
                  onClick={h.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </span>
                    {sorted === 'asc' && <span>↑</span>}
                    {sorted === 'desc' && <span>↓</span>}
                  </div>
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            onClick={() => navigate(`/jobs/${row.original.id}`)}
            className="cursor-pointer"
          >
            {row.getVisibleCells().map((cell) => {
              const raw = cell.getValue()
              const tooltip = typeof raw === 'string' ? raw : undefined
              return (
                <TableCell
                  key={cell.id}
                  style={{
                    width: cell.column.getSize(),
                    maxWidth: cell.column.getSize(),
                  }}
                  className="truncate"
                  title={tooltip}
                >
                  {flexRender(
                    cell.column.columnDef.cell ?? cell.column.columnDef.header,
                    cell.getContext(),
                  )}
                </TableCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
