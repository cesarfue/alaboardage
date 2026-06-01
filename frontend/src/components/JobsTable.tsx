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
  },
  {
    accessorKey: 'company',
    header: 'Société',
  },
  {
    accessorKey: 'location',
    header: 'Lieu',
  },
  {
    accessorKey: 'source',
    header: 'Source',
    cell: ({ getValue }) => (
      <span className="text-xs px-2 py-0.5 rounded bg-muted">
        {String(getValue())}
      </span>
    ),
  },
  {
    accessorKey: 'datePosted',
    header: 'Date',
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
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => {
              const sorted = h.column.getIsSorted()
              return (
                <TableHead
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  className="cursor-pointer select-none"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {sorted === 'asc' && ' ↑'}
                  {sorted === 'desc' && ' ↓'}
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
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell ?? cell.column.columnDef.header, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
