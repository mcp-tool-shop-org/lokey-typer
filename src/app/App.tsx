import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@app/shell'
import { DailySetPage, HomePage, ModePage, RunPage } from '@features'
import { Icon } from '@app/components/Icon'

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl bg-zinc-900/40 px-6 py-8 text-center animate-fade-in sm:px-8 sm:py-12">
      <Icon name="search" size={28} className="text-zinc-500" />
      <div>
        <h1 className="text-sm font-semibold text-zinc-50">Page not found</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Nothing here. It may have been moved or removed.
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700/50 bg-zinc-800/80 px-5 py-2.5 text-sm font-semibold text-zinc-300 no-underline transition duration-150 hover:bg-zinc-700 hover:border-zinc-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
      >
        <Icon name="home" size={14} className="shrink-0" />
        Go home
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />

        <Route path="daily" element={<DailySetPage />} />

        <Route path="focus" element={<ModePage mode="focus" />} />
        <Route path="focus/run/:exerciseId" element={<RunPage mode="focus" />} />

        <Route path="real-life" element={<ModePage mode="real_life" />} />
        <Route path="real-life/run/:exerciseId" element={<RunPage mode="real_life" />} />

        <Route path="competitive" element={<ModePage mode="competitive" />} />
        <Route path="competitive/run/:exerciseId" element={<RunPage mode="competitive" />} />

        <Route path="practice" element={<Navigate to="/focus" replace />} />
        <Route path="arcade" element={<Navigate to="/competitive" replace />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
