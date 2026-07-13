import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { docsUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export default async function DocsProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const session = cookieStore.get('docs_session')

  if (!session || session.value !== 'authenticated') {
    redirect('/docs/login')
  }

  // Read the API key cookie set at login time (non-httpOnly, available here too)
  const apiKeyCookie = cookieStore.get('docs_api_key')
  const userNameCookie = cookieStore.get('docs_user_name')

  const apiKey = apiKeyCookie?.value ?? process.env.INTERNAL_ENV_API_KEY ?? ''
  const userName = userNameCookie?.value ?? 'Developer'

  return (
    <>
      <div
        id="__docs_env"
        data-api-key={apiKey}
        data-user-name={userName}
        style={{ display: 'none' }}
      />
      {children}
    </>
  )
}
