import { Link } from 'react-router-dom'

import { Badge, Card, EmptyState, Spinner } from '@/components/ui'
import { useListStaffQuery } from '@/features/staff/staffApi'

import { usePGWorkspace } from './context'

/**
 * Guide 11 — staff assigned to this PG.
 *
 * Filtered from the owner's full staff list by assignment. Capability is
 * identical for every staff member in the MVP; only which PGs they can reach
 * differs, which is exactly what this tab shows.
 */
export default function PGStaffTab() {
  const { pg } = usePGWorkspace()
  const { data: staff = [], isLoading } = useListStaffQuery()

  const assigned = staff.filter((member) =>
    member.assigned_pgs.some((assignment) => assignment.id === pg.id),
  )

  if (isLoading) return <Spinner label="Loading staff" />

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {assigned.length} staff member(s) assigned to {pg.name}.
        </p>
        <Link
          to="/staff"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          Manage all staff →
        </Link>
      </div>

      {assigned.length === 0 ? (
        <EmptyState
          title="No staff assigned to this PG"
          hint="Add a staff member from the Staff screen and assign them here."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
                  <th className="py-2 pr-3">Staff name</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Other PGs</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {assigned.map((member) => {
                  const others = member.assigned_pgs.filter((a) => a.id !== pg.id)
                  return (
                    <tr key={member.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-slate-800">
                        {member.full_name}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">
                        {member.staff_title ?? 'Staff'}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">{member.phone}</td>
                      <td className="py-2.5 pr-3 text-slate-500">
                        {others.length === 0
                          ? '—'
                          : others.map((a) => a.name).join(', ')}
                      </td>
                      <td className="py-2.5">
                        <Badge tone={member.is_active ? 'green' : 'slate'}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}
