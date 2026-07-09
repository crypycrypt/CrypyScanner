"use client"

type Props = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null

  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      <button className="btn-theme btn-theme-sm disabled:opacity-40" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Prev
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          className={`btn-theme btn-theme-sm ${p === page ? 'ring-2 ring-[rgba(0,240,255,0.45)]' : ''}`}
          onClick={() => onPageChange(p)}>
          {p}
        </button>
      ))}
      <button className="btn-theme btn-theme-sm disabled:opacity-40" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
      <span className="text-xs text-slate-500 ml-2">Page {page} of {totalPages}</span>
    </div>
  )
}
