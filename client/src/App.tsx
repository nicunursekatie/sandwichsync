import React from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingState } from "@/components/ui/loading";
import { ErrorBoundary } from "@/components/error-boundary";

import Dashboard from "@/pages/dashboard";
import Landing from "@/pages/landing";
import SignupPage from "@/pages/signup";
import NotFound from "@/pages/not-found";

// Conditional auth imports
const AuthProvider = import.meta.env.VITE_AUTH_MODE === 'supabase' 
  ? React.lazy(() => import("@/contexts/AuthContext").then(m => ({ default: m.AuthProvider })))
  : null;

const AuthPage = import.meta.env.VITE_AUTH_MODE === 'supabase'
  ? React.lazy(() => import("@/pages/auth").then(m => ({ default: m.AuthPage })))
  : null;

function Router() {
  const { isAuthenticated, isLoading, error } = useAuth();

  if (isLoading) {
    return <LoadingState text="Authenticating..." size="lg" className="min-h-screen" />;
  }

  // Enhanced error handling for authentication issues
  if (error && error.message && !error.message.includes('401')) {
    console.error('[App] Authentication error:', error);
    // For non-401 errors, show error state
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md p-6 bg-white rounded-lg shadow-lg text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-4">There was a problem verifying your account.</p>
          <button 
            onClick={() => window.location.href = "/api/login"}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // If not authenticated, show appropriate auth flow
  if (!isAuthenticated) {
    // For Supabase auth, show the auth page
    if (import.meta.env.VITE_AUTH_MODE === 'supabase' && AuthPage) {
      return (
        <Switch>
          <Route path="/signup" component={SignupPage} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/" component={AuthPage} />
          <Route component={AuthPage} />
        </Switch>
      );
    }
    
    // For temp auth, show landing page
    return (
      <Switch>
        <Route path="/signup" component={SignupPage} />
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
