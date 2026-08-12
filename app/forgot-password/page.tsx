'use client'

import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { SoccerBallIcon } from '@/components/icons/SoccerBallIcon'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="animate-slide-up-fade text-center">
          <div className="mb-4 flex justify-center">
            <SoccerBallIcon className="h-16 w-16 animate-float text-red-50" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-red-50">
            Soccerville
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Reset your account password
          </p>
        </div>

        <Card
          className="card-soccer-accent animate-slide-up-fade shadow-lg"
          style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}
        >
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-2xl font-bold">
              Forgot password
            </CardTitle>
            <CardDescription className="text-center">
              We&apos;ll email you a link to choose a new password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ForgotPasswordForm />
            <div className="mt-4 text-center text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Remember your password?{' '}
              </span>
              <Link
                href="/login"
                className="font-medium text-red-50 hover:underline dark:text-red-400"
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
