import { describe, expect, it } from 'vitest'
import { AuthorizationService, type AuthContext } from './AuthorizationService'

const service = new AuthorizationService()
const context = (role: AuthContext['role'], workspaceType: AuthContext['workspaceType'] = 'TEAM'): AuthContext => ({
  userId: 'user-1', workspaceId: 'workspace-1', workspaceType, role,
})

describe('AuthorizationService', () => {
  it('allows public reads across workspace boundaries but hides private resources', () => {
    expect(() => service.authorize(context('VIEWER'), 'resource:read', { workspaceId: 'other', visibility: 'PUBLIC' })).not.toThrow()
    expect(() => service.authorize(context('VIEWER'), 'resource:read', { workspaceId: 'other', visibility: 'PRIVATE' })).toThrow('Not found')
  })

  it('allows editors to edit and run but not manage secrets or visibility', () => {
    expect(() => service.authorize(context('EDITOR'), 'resource:edit')).not.toThrow()
    expect(() => service.authorize(context('EDITOR'), 'pipeline:run')).not.toThrow()
    expect(() => service.authorize(context('EDITOR'), 'destination:manage')).toThrow('Forbidden')
    expect(() => service.authorize(context('EDITOR'), 'resource:visibility')).toThrow('Forbidden')
  })

  it('keeps viewers read-only and Community immutable', () => {
    expect(() => service.authorize(context('VIEWER'), 'resource:edit')).toThrow('Forbidden')
    expect(() => service.authorize(context('OWNER', 'COMMUNITY'), 'resource:edit')).toThrow('Forbidden')
  })

  it('never permits mutations against another workspace', () => {
    expect(() => service.authorize(context('OWNER'), 'resource:delete', { workspaceId: 'other' })).toThrow('Forbidden')
  })
})
