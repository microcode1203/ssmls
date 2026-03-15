import { Link } from 'react-router-dom'
export default function NotFoundPage() {
 return (
 <div className="min-h-screen flex flex-col items-center justify-center text-center p-8">
 <p className="text-8xl font-display font-bold text-slate-200">404</p>
 <h2 className="text-2xl font-bold text-slate-800 mt-4">Page not found</h2>
 <p className="text-slate-500 mt-2">The page you're looking for doesn't exist.</p>
 <Link to="/dashboard"className="btn-primary mt-6">Go to Dashboard</Link>
 </div>
 )
}
