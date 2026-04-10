import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'

const pageVariants = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } }
const PageTransition = ({ children }) => (
  <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.3 }}>
    {children}
  </motion.div>
)

function RegisterPage({ navigate }) {
  const { signUp } = useAuth()
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', orgName: '', industry: '', gdprConsent: false })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.gdprConsent) { setError('You must consent to data processing.'); return }
    setError(''); setLoading(true)
    try {
      await signUp(form.email, form.password, {
        first_name: form.firstName,
        last_name: form.lastName,
        organisation_name: form.orgName,
        industry: form.industry
      })
      navigate('/dashboard')
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create your CRI account</h1>
        <p className="text-gray-500 mb-6">Start measuring cultural readiness today</p>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="First name" className="w-full p-3 border border-gray-200 rounded-xl" value={form.firstName} onChange={handleChange('firstName')} required />
            <input type="text" placeholder="Last name" className="w-full p-3 border border-gray-200 rounded-xl" value={form.lastName} onChange={handleChange('lastName')} required />
          </div>
          <input type="email" placeholder="Work email" className="w-full p-3 border border-gray-200 rounded-xl" value={form.email} onChange={handleChange('email')} required />
          <input type="password" placeholder="Password (min 8 characters)" className="w-full p-3 border border-gray-200 rounded-xl" minLength={8} value={form.password} onChange={handleChange('password')} required />
          <input type="text" placeholder="Organisation name" className="w-full p-3 border border-gray-200 rounded-xl" value={form.orgName} onChange={handleChange('orgName')} required />
          <select className="w-full p-3 border border-gray-200 rounded-xl" value={form.industry} onChange={handleChange('industry')} required>
            <option value="">Select industry</option>
            {['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Consulting', 'Other'].map(i => <option key={i}>{i}</option>)}
          </select>
          <label className="flex items-start gap-3 text-sm text-gray-600">
            <input type="checkbox" className="mt-1 rounded" checked={form.gdprConsent} onChange={handleChange('gdprConsent')} required />
            <span>I consent to data processing under GDPR, POPIA, and Nigeria's NDPA 2023.</span>
          </label>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-6">Already have an account? <button onClick={() => navigate('/login')} className="text-blue-600 font-medium">Sign in</button></p>
      </div>
    </div>
  )
}

function LoginPage({ navigate }) {
  const { signIn } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try { await signIn(form.email, form.password); navigate('/dashboard') } catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
        <p className="text-gray-500 mb-6">Sign in to your CRI account</p>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" placeholder="Email" className="w-full p-3 border border-gray-200 rounded-xl" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          <input type="password" placeholder="Password" className="w-full p-3 border border-gray-200 rounded-xl" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition">{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-6">Don't have an account? <button onClick={() => navigate('/register')} className="text-blue-600 font-medium">Start free trial</button></p>
      </div>
    </div>
  )
}

function Dashboard({ navigate }) {
  const { user } = useAuth()
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const fetchAssessments = async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select('id, name, target_country, response_count, overall_score, status')
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false })
      if (!error) setAssessments(data || [])
      setLoading(false)
    }
    if (user) fetchAssessments()
  }, [user])
  const totalResponses = assessments.reduce((sum, a) => sum + (a.response_count || 0), 0)
  const avgScore = assessments.reduce((sum, a) => sum + (a.overall_score || 0), 0) / (assessments.filter(a => a.overall_score).length || 1)
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8"><h1 className="text-3xl font-bold">Welcome, {user?.user_metadata?.first_name || user?.email?.split('@')[0]}</h1><p className="text-gray-500">Your CRI dashboard</p></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6"><div className="text-3xl font-bold text-blue-600">{assessments.length}</div><div className="text-gray-600">Assessments</div></div>
        <div className="bg-white rounded-xl shadow p-6"><div className="text-3xl font-bold text-green-600">{totalResponses}</div><div className="text-gray-600">Responses</div></div>
        <div className="bg-white rounded-xl shadow p-6"><div className="text-3xl font-bold text-amber-600">{avgScore.toFixed(1)}</div><div className="text-gray-600">Avg. CRI Score</div></div>
      </div>
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Assessments</h2>
        {loading ? <p>Loading...</p> : assessments.length === 0 ? <p className="text-gray-500">No assessments yet. Create your first one.</p> : (
          <div className="space-y-3">
            {assessments.slice(0, 5).map(a => (
              <div key={a.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div><span className="font-medium">{a.name}</span><span className="text-sm text-gray-500 ml-2">{a.target_country}</span></div>
                <button onClick={() => navigate(`/assessments/${a.id}`)} className="text-blue-600">View →</button>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => navigate('/assessments/new')} className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">+ New Assessment</button>
      </div>
    </div>
  )
}

function AssessmentsList({ navigate }) {
  const { user } = useAuth()
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const fetchAssessments = async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select('id, name, target_country, response_count, min_responses, overall_score, status, created_at')
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false })
      if (!error) setAssessments(data || [])
      setLoading(false)
    }
    if (user) fetchAssessments()
  }, [user])
  if (loading) return <div className="p-6">Loading...</div>
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold">Assessments</h1><button onClick={() => navigate('/assessments/new')} className="bg-blue-600 text-white px-4 py-2 rounded-lg">+ New</button></div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {assessments.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No assessments yet. Click "New" to start.</div>
        ) : (
          <table className="min-w-full"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responses</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-6 py-3"></th></tr></thead>
          <tbody className="divide-y divide-gray-100">{assessments.map(a => (<tr key={a.id}><td className="px-6 py-4 font-medium">{a.name}</td><td className="px-6 py-4">{a.target_country}</td><td className="px-6 py-4">{a.response_count} / {a.min_responses}</td><td className="px-6 py-4">{a.overall_score ? a.overall_score.toFixed(1) : '—'}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs ${a.status === 'active' ? 'bg-green-100 text-green-700' : a.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{a.status}</span></td><td className="px-6 py-4"><button onClick={() => navigate(`/assessments/${a.id}`)} className="text-blue-600 hover:underline">Manage</button></td></tr>))}</tbody></table>
        )}
      </div>
    </div>
  )
}

function NewAssessment({ navigate }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ name: "", description: "", targetCountry: "Nigeria", targetIndustry: "Technology", minResponses: 5 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const ensureUserRecord = async () => {
    if (!user) return null
    let { data: existing, error: fetchError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()
    if (fetchError) throw new Error("Error checking user: " + fetchError.message)
    if (!existing) {
      const { error: insertError } = await supabase
        .from("users")
        .insert({
          id: user.id,
          email: user.email,
          password_hash: "dummy-hash-not-used-because-auth-is-handled-by-supabase",
          first_name: user.user_metadata?.first_name || null,
          last_name: user.user_metadata?.last_name || null,
          role: "admin",
          is_active: true,
          gdpr_consent: true,
          popia_consent: true,
          ndpa_consent: true,
          consent_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      if (insertError) {
        console.error("Insert error details:", insertError)
        throw new Error("Failed to create user record: " + insertError.message)
      }
    }
    return user.id
  }

  const ensureOrganization = async () => {
    if (!user) return null
    await ensureUserRecord()
    let { data: org, error } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle()
    if (error || !org) {
      const orgName = user.user_metadata?.organisation_name || user.user_metadata?.orgName || "My Organization"
      const { data: newOrg, error: createError } = await supabase
        .from("organizations")
        .insert({ owner_user_id: user.id, name: orgName, plan: "trial" })
        .select()
        .single()
      if (createError) {
        console.error(createError)
        throw new Error("Failed to create organization: " + createError.message)
      }
      return newOrg.id
    }
    return org.id
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError("")
    try {
      const orgId = await ensureOrganization()
      if (!orgId) throw new Error("Could not determine organization")
      const { data, error } = await supabase
        .from("assessments")
        .insert({
          name: form.name,
          description: form.description,
          target_country: form.targetCountry,
          target_industry: form.targetIndustry,
          min_responses: form.minResponses,
          created_by: user.id,
          organization_id: orgId,
          status: "draft"
        })
        .select()
        .single()
      if (error) throw error
      navigate(`/assessments/${data.id}`)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Assessment</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
        <input className="w-full p-3 border rounded-lg" placeholder="Assessment name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
        <textarea className="w-full p-3 border rounded-lg" placeholder="Description (optional)" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        <select className="w-full p-3 border rounded-lg" value={form.targetCountry} onChange={e => setForm({...form, targetCountry: e.target.value})}>
          {["Nigeria","Kenya","South Africa","Ghana","Egypt","Ethiopia"].map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="w-full p-3 border rounded-lg" value={form.targetIndustry} onChange={e => setForm({...form, targetIndustry: e.target.value})}>
          {["Technology","Finance","Healthcare","Manufacturing","Telecommunications","Consulting","General"].map(i => <option key={i}>{i}</option>)}
        </select>
        <input type="number" className="w-full p-3 border rounded-lg" placeholder="Minimum responses to unlock scores" value={form.minResponses} onChange={e => setForm({...form, minResponses: parseInt(e.target.value)})} min={3} max={100} />
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition">{loading ? "Creating..." : "Create Assessment"}</button>
      </form>
    </div>
  )
}

function AssessmentDetail({ id, navigate }) {
  const [assessment, setAssessment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [surveyLink, setSurveyLink] = useState('')
  useEffect(() => {
    const fetchAssessment = async () => {
      const { data, error } = await supabase.from('assessments').select('*').eq('id', id).single()
      if (!error) {
        setAssessment(data)
        setSurveyLink(`${window.location.origin}/survey/${data.survey_token}`)
      }
      setLoading(false)
    }
    fetchAssessment()
  }, [id])
  const copyLink = () => { navigator.clipboard.writeText(surveyLink); alert('Survey link copied!') }
  const activateAssessment = async () => {
    const { error } = await supabase.from('assessments').update({ status: 'active' }).eq('id', id)
    if (!error) setAssessment({ ...assessment, status: 'active' })
  }
  if (loading) return <div className="p-6">Loading...</div>
  if (!assessment) return <div className="p-6">Assessment not found.</div>
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => navigate('/assessments')} className="text-blue-600 mb-4">← Back to assessments</button>
      <div className="bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-2">{assessment.name}</h1>
        <p className="text-gray-500 mb-4">{assessment.target_country} · {assessment.target_industry || 'General'}</p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div><span className="text-gray-500">Responses:</span> <span className="font-medium">{assessment.response_count || 0} / {assessment.min_responses}</span></div>
          <div><span className="text-gray-500">Status:</span> <span className={`px-2 py-1 rounded-full text-xs ${assessment.status === 'active' ? 'bg-green-100 text-green-700' : assessment.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>{assessment.status}</span></div>
          <div><span className="text-gray-500">Overall Score:</span> <span className="font-medium">{assessment.overall_score ? assessment.overall_score.toFixed(1) : '—'}</span></div>
          <div><span className="text-gray-500">Created:</span> <span>{new Date(assessment.created_at).toLocaleDateString()}</span></div>
        </div>
        {assessment.status === 'draft' && (
          <button onClick={activateAssessment} className="bg-green-600 text-white px-4 py-2 rounded-lg mb-4">Activate Survey</button>
        )}
        {assessment.status === 'active' && (
          <div className="mb-4"><p className="text-gray-700 mb-2">Survey link (share with participants):</p><div className="flex gap-2"><input type="text" readOnly value={surveyLink} className="flex-1 p-2 border rounded-lg bg-gray-50" /><button onClick={copyLink} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Copy</button></div></div>
        )}
        {assessment.response_count >= 1 && !assessment.overall_score && (
          <button onClick={async () => { const res = await fetch("https://vvoiagwlfhowdyxlkpln.supabase.co/functions/v1/compute-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assessmentId: assessment.id }) }); if (res.ok) { alert("Scores computed! Refresh the page."); window.location.reload(); } else { alert("Failed to compute scores."); } }} className="bg-amber-600 text-white px-4 py-2 rounded-lg">Compute Scores</button>
        )}
        {assessment.overall_score && (
          <button onClick={() => navigate(`/reports/${id}`)} className="bg-blue-600 text-white px-4 py-2 rounded-lg">View Report</button>
        )}
      </div>
    </div>
  )
}

function SurveyPage({ token }) {
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const loadQuestions = async () => {
      const { data } = await supabase.from('question_bank').select('*').eq('country', 'Nigeria')
      if (data) setQuestions(data)
      setLoading(false)
    }
    loadQuestions()
  }, [])
  const handleAnswer = (qid, value) => setAnswers({ ...answers, [qid]: value })
  const submitSurvey = async () => {
    const { error } = await supabase.from('responses').insert({ assessment_id: null, session_token: token, answers })
    if (!error) setSubmitted(true)
  }
  if (loading) return <div className="p-6">Loading survey...</div>
  if (submitted) return <div className="p-8 text-center"><h1 className="text-2xl font-bold">Thank you!</h1><p className="mt-2">Your responses have been recorded.</p></div>
  const currentQ = questions[step]
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Cultural Readiness Survey</h1>
      {currentQ ? (
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-lg mb-4">{currentQ.question_text}</p>
          <div className="flex gap-2 flex-wrap">
            {[1,2,3,4,5].map(val => (
              <button key={val} onClick={() => handleAnswer(currentQ.question_id, val)} className={`px-4 py-2 border rounded-lg ${answers[currentQ.question_id] === val ? 'bg-blue-600 text-white' : 'bg-white'}`}>{val}</button>
            ))}
          </div>
          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(s => s-1)} disabled={step===0} className="text-gray-500">Previous</button>
            <button onClick={() => step+1 < questions.length ? setStep(s => s+1) : submitSurvey()} className="bg-blue-600 text-white px-4 py-2 rounded-lg">{step+1 < questions.length ? 'Next' : 'Submit'}</button>
          </div>
        </div>
      ) : <p>No questions found.</p>}
    </div>
  )
}

function ReportsList({ navigate }) {
  const { user } = useAuth()
  const [reports, setReports] = useState([])
  useEffect(() => {
    const fetchReports = async () => {
      const { data } = await supabase.from('assessments').select('id, name, target_country, overall_score, colour_band').eq('created_by', user?.id).not('overall_score', 'is', null)
      if (data) setReports(data)
    }
    if (user) fetchReports()
  }, [user])
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Reports</h1>
      {reports.length === 0 ? <div className="bg-white rounded-xl shadow p-12 text-center text-gray-500">No reports yet. Complete an assessment to generate a report.</div> : (
        <div className="bg-white rounded-xl shadow overflow-hidden"><table className="min-w-full"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left">Assessment</th><th className="px-6 py-3 text-left">Country</th><th className="px-6 py-3 text-left">Score</th><th className="px-6 py-3 text-left">Band</th><th></th></tr></thead><tbody className="divide-y">{reports.map(r => (<tr key={r.id}><td className="px-6 py-4">{r.name}</td><td className="px-6 py-4">{r.target_country}</td><td className="px-6 py-4">{r.overall_score?.toFixed(1)}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs ${r.colour_band === 'green' ? 'bg-green-100 text-green-700' : r.colour_band === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{r.colour_band}</span></td><td className="px-6 py-4"><button onClick={() => navigate(`/reports/${r.id}`)} className="text-blue-600">View</button></td></tr>))}</tbody></table></div>
      )}
    </div>
  )
}

function AdminPanel() {
  const [stats, setStats] = useState({})
  useEffect(() => {
    const fetchStats = async () => {
      const { count: assessments } = await supabase.from('assessments').select('*', { count: 'exact', head: true })
      const { count: responses } = await supabase.from('responses').select('*', { count: 'exact', head: true })
      const { data: payments } = await supabase.from('payments').select('amount_cents')
      const totalRevenue = payments?.reduce((s, p) => s + p.amount_cents, 0) / 100 || 0
      setStats({ assessments, responses, revenue: totalRevenue })
    }
    fetchStats()
  }, [])
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6"><div className="text-3xl font-bold text-blue-600">{stats.assessments || 0}</div><div className="text-gray-600">Total Assessments</div></div>
        <div className="bg-white rounded-xl shadow p-6"><div className="text-3xl font-bold text-green-600">{stats.responses || 0}</div><div className="text-gray-600">Total Responses</div></div>
        <div className="bg-white rounded-xl shadow p-6"><div className="text-3xl font-bold text-amber-600">${stats.revenue?.toLocaleString() || 0}</div><div className="text-gray-600">Revenue</div></div>
      </div>
    </div>
  )
}

function App() {
  const { user, loading } = useAuth()
  const [route, setRoute] = useState(window.location.pathname === '/' ? '/dashboard' : window.location.pathname)
  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])
  const navigate = (to) => { window.history.pushState({}, '', to); setRoute(to) }
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>
  if (!user && route !== '/register' && route !== '/login') return <LoginPage navigate={navigate} />
  const content = (() => {
    switch (route) {
      case '/register': return <RegisterPage navigate={navigate} />
      case '/login': return <LoginPage navigate={navigate} />
      case '/dashboard': return <Dashboard navigate={navigate} />
      case '/assessments': return <AssessmentsList navigate={navigate} />
      case '/assessments/new': return <NewAssessment navigate={navigate} />
      case '/reports': return <ReportsList navigate={navigate} />
      case '/admin': return <AdminPanel navigate={navigate} />
      default: if (route.startsWith('/assessments/')) return <AssessmentDetail id={route.split('/')[2]} navigate={navigate} />
               if (route.startsWith('/survey/')) return <SurveyPage token={route.split('/')[2]} navigate={navigate} />
               if (route.startsWith('/reports/')) return <ReportsList navigate={navigate} />
               return <Dashboard navigate={navigate} />
    }
  })()
  return <AnimatePresence mode="wait"><PageTransition key={route}>{content}</PageTransition></AnimatePresence>
}

export default function Root() {
  return <AuthProvider><App /></AuthProvider>
}
