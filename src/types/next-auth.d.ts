import type { Role } from '@/lib/auth/policy'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
      canViewCosts: boolean
      isFieldOnly: boolean
      isActive: boolean
    } & DefaultSession['user']
  }

  interface User {
    role: Role
    canViewCosts: boolean
    isFieldOnly: boolean
    isActive: boolean
  }
}

declare module 'next-auth/adapters' {
  interface AdapterUser {
    role: Role
    canViewCosts: boolean
    isFieldOnly: boolean
    isActive: boolean
  }
}
