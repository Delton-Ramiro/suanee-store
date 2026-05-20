import { prisma } from './prisma.js'

export async function audit(opts: {
  adminId: string
  action: string
  resourceType: string
  resourceId?: string
  before?: unknown
  after?: unknown
}): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      adminId: opts.adminId,
      action: opts.action,
      resourceType: opts.resourceType,
      resourceId: opts.resourceId,
      changesJson:
        opts.before !== undefined || opts.after !== undefined
          ? { before: opts.before ?? null, after: opts.after ?? null }
          : undefined,
    },
  })
}
