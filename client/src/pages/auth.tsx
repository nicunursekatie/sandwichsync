import React, { useState } from 'react'
import { LoginForm, SignUpForm } from '../components/auth/AuthForms'
import { Button } from '../components/ui/button'

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            The Sandwich Project
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Community platform for organizing food distribution
          </p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="flex">
            <button
              className={`flex-1 py-2 px-4 text-center font-medium rounded-tl-lg ${
                isLogin
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setIsLogin(true)}
            >
              Sign In
            </button>
            <button
              className={`flex-1 py-2 px-4 text-center font-medium rounded-tr-lg ${
                !isLogin
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setIsLogin(false)}
            >
              Sign Up
            </button>
          </div>

          <div className="p-6">
            {isLogin ? <LoginForm /> : <SignUpForm />}
          </div>
        </div>

        <div className="text-center text-sm text-gray-600">
          <p>
            Having trouble? Contact your administrator for access.
          </p>
        </div>
      </div>
    </div>
  )
}
