import { useState } from 'react'

import { Badge, Button, Spinner } from '@/components/ui'
import { PageHeader } from '@/components/ui/AppShell'
import { DataTable, type Column } from '@/components/tables/DataTable'
import type { StaffMember } from '@/types/api'

import { AddStaffForm } from './AddStaffForm'
import { useListStaffQuery, useUpdateStaffMutation } from './staffApi'

export default function StaffPage() {
  const { data: staff = [], isLoading } = useListStaffQuery()
  const [updateStaff] = useUpdateStaffMutation()
  const [showForm, setShowForm] = useState(false)

  // Matches the Staff Overview table: Name, Role, Property Access, Status.
  const columns: Column<StaffMember>[] = [
    {
      header: 'Name',
      cell: (member) => (
        <div>
          <p className="font-medium text-slate-900">{member.full_name}</p>
          <p className="text-xs text-slate-500">{member.email}</p>
        </div>
      ),
    },
    { header: 'Role', cell: (member) => member.staff_title ?? '—' },
    {
      header: 'Property access',
      cell: (member) =>
        member.assigned_pgs.length === 0 ? (
          <span className="text-slate-400">None</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {member.assigned_pgs.map((pg) => (
              <Badge key={pg.id} tone="blue">
                {pg.name}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      header: 'Status',
      cell: (member) =>
        member.is_active ? (
          <Badge tone="green">Active</Badge>
        ) : (
          <Badge tone="slate">Inactive</Badge>
        ),
    },
    {
      header: 'Action',
      align: 'right',
      cell: (member) => (
        <button
          type="button"
          onClick={() => updateStaff({ id: member.id, is_active: !member.is_active })}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          {member.is_active ? 'Deactivate' : 'Reactivate'}
        </button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Staff"
        description="Staff access is set per PG. Capability itself is the same for everyone."
        action={
          showForm ? null : <Button onClick={() => setShowForm(true)}>+ Add staff</Button>
        }
      />

      {showForm ? <AddStaffForm onDone={() => setShowForm(false)} /> : null}

      {isLoading ? (
        <Spinner label="Loading staff" />
      ) : (
        <DataTable
          columns={columns}
          rows={staff}
          rowKey={(member) => member.id}
          emptyMessage="No staff yet — add a manager and assign them to a PG."
        />
      )}
    </>
  )
}
