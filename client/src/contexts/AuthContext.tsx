import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, authHelpers, UserProfile } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, userData?: Partial<UserProfile>) => Promise<{ error: any }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { session } = await authHelpers.getCurrentSession()
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const userProfile = await authHelpers.getUserProfile(session.user.id)
        setProfile(userProfile)
      }
      
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const userProfile = await authHelpers.getUserProfile(session.user.id)
        setProfile(userProfile)
      } else {
        setProfile(null)
      }
      
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await authHelpers.signIn(email, password)
    return { error }
  }

  const signUp = async (email: string, password: string, userData?: Partial<UserProfile>) => {
    const { data, error } = await authHelpers.signUp(email, password, userData)
    
    // If signup successful and we have a user, create their profile
    if (data.user && !error) {
      await authHelpers.createUserProfile(data.user.id, {
        email: data.user.email!,
        role: userData?.role || 'viewer',
        full_name: userData?.full_name,
        phone: userData?.phone,
        committee_id: userData?.committee_id
      })
    }
    
    return { error }
  }

  const signOut = async () => {
    await authHelpers.signOut()
    setUser(null)
    setProfile(null)
    setSession(null)
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('No user logged in') }
    
    const { data, error } = await authHelpers.updateUserProfile(user.id, updates)
    
    if (data && !error) {
      setProfile(data)
    }
    
    return { error }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Protected route wrapper
export function ProtectedRoute({ 
  children, 
  requiredRole, 
  fallback 
}: { 
  children: React.ReactNode
  requiredRole?: string
  fallback?: React.ReactNode
}) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  if (!user || !profile) {
    return fallback || <div>Please sign in to access this page.</div>
  }

  if (requiredRole && profile.role !== requiredRole && profile.role !== 'admin' && profile.role !== 'super_admin') {
    return <div>You don't have permission to access this page.</div>
  }

  return <>{children}</>
}
