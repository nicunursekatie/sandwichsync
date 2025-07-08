import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET
const SUPABASE_URL = process.env.VITE_SUPABASE_URL

interface SupabaseUser {
  aud: string
  exp: number
  iat: number
  iss: string
  sub: string
  email?: string
  phone?: string
  app_metadata: {
    provider?: string
    providers?: string[]
  }
  user_metadata: any
  role?: string
}

interface AuthenticatedRequest extends Request {
  user?: SupabaseUser
  userProfile?: any
}

// Create JWKS client for token verification
const client = jwksClient({
  jwksUri: `${SUPABASE_URL}/rest/v1/auth/jwks`,
  requestHeaders: {}, // Optional
  timeout: 30000, // Defaults to 30s
})

function getKey(header: any, callback: (err: any, key?: string) => void) {
  client.getSigningKey(header.kid, (err: any, key: any) => {
    if (err) {
      callback(err)
      return
    }
    const signingKey = key?.getPublicKey()
    callback(null, signingKey)
  })
}

export function authenticateSupabaseJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided' })
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  // Verify the JWT token
  jwt.verify(token, getKey, {
    audience: 'authenticated',
    issuer: SUPABASE_URL,
    algorithms: ['RS256']
  }, (err: any, decoded: any) => {
    if (err) {
      console.error('JWT verification error:', err)
      return res.status(401).json({ error: 'Invalid token' })
    }

    req.user = decoded as SupabaseUser
    next()
  })
}

export function optionalAuthentication(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided, continue without authentication
    return next()
  }

  const token = authHeader.substring(7)

  jwt.verify(token, getKey, {
    audience: 'authenticated',
    issuer: SUPABASE_URL,
    algorithms: ['RS256']
  }, (err: any, decoded: any) => {
    if (err) {
      console.error('JWT verification error:', err)
      // Don't fail for optional auth, just continue without user
      return next()
    }

    req.user = decoded as SupabaseUser
    next()
  })
}

// Role-based access control
export function requireRole(allowedRoles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Get user profile from database to check role
    try {
      const { storage } = await import('./storage-wrapper')
      const userProfile = await storage.getUserByEmail(req.user.email!)
      
      if (!userProfile || !allowedRoles.includes(userProfile.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      // Add profile to request for later use
      req.userProfile = userProfile
      next()
    } catch (error) {
      console.error('Error checking user role:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return requireRole(['admin', 'super_admin'])(req, res, next)
}

export function requireCommitteeMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return requireRole(['admin', 'super_admin', 'committee_member'])(req, res, next)
}

// Compatibility middleware to work with existing temp auth system
export function compatibilityAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // First try Supabase auth
  const authHeader = req.headers.authorization
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateSupabaseJWT(req, res, next)
  }
  
  // Fall back to session-based auth (temp auth system)
  const sessionUser = req.session?.user
  if (sessionUser) {
    req.user = {
      sub: sessionUser.id,
      email: sessionUser.email,
      role: sessionUser.role,
      aud: 'authenticated',
      exp: Date.now() / 1000 + 3600, // 1 hour from now
      iat: Date.now() / 1000,
      iss: 'temp-auth',
      app_metadata: {},
      user_metadata: {}
    }
    return next()
  }
  
  return res.status(401).json({ error: 'Authentication required' })
}
