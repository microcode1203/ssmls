/* @v2-fixed-imports */

// Base shimmer skeleton block
export function Skeleton({ className = '', style = {} }) {
  return (
    <div
      className={'skeleton ' + className}
      style={style}
    />
  )
}

// Stat card skeleton — matches StatCard layout
export function StatCardSkeleton() {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0"/>
        <div className="skeleton h-4 w-24 rounded"/>
      </div>
      <div className="skeleton h-8 w-16 rounded mb-1.5"/>
      <div className="skeleton h-3 w-32 rounded"/>
    </div>
  )
}

// Table row skeleton
export function TableRowSkeleton({ cols = 5 }) {
  const widths = ['w-32','w-24','w-20','w-28','w-16','w-12']
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className={'skeleton h-4 rounded ' + (widths[i % widths.length])}/>
        </td>
      ))}
    </tr>
  )
}

// Table skeleton — header + rows
export function TableSkeleton({ cols = 5, rows = 5, headers = [] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className="skeleton h-4 w-32 rounded"/>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-2.5">
                  <div className="skeleton h-3 w-16 rounded"/>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} cols={cols}/>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Card grid skeleton
export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="skeleton w-9 h-9 rounded-xl flex-shrink-0"/>
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-3/4 rounded"/>
              <div className="skeleton h-3 w-1/2 rounded"/>
            </div>
          </div>
          <div className="skeleton h-3 w-full rounded"/>
          <div className="skeleton h-3 w-2/3 rounded"/>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="skeleton h-3 w-20 rounded"/>
            <div className="skeleton h-3 w-12 rounded"/>
          </div>
        </div>
      ))}
    </div>
  )
}

// Dashboard skeleton — full dashboard loading state
export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i}/>)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i}/>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-4">
            <div className="skeleton h-5 w-40 rounded"/>
            <div className="skeleton h-3 w-28 rounded"/>
            <div className="skeleton h-32 w-full rounded-lg"/>
          </div>
        ))}
      </div>
    </div>
  )
}

// Generic page skeleton
export function PageSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton h-7 w-48 rounded-lg"/>
          <div className="skeleton h-4 w-64 rounded"/>
        </div>
        <div className="skeleton h-10 w-32 rounded-xl"/>
      </div>
      <TableSkeleton cols={5} rows={6}/>
    </div>
  )
}
