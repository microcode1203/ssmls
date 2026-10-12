// @v2-fixed-imports
import { useState, useEffect } from 'react'
import { TableSkeleton, CardGridSkeleton, PageSkeleton } from '../../components/ui/Skeleton'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import toast from 'react-hot-toast'
import { Save, Settings, School, Calendar, BookOpen, Bell, ImagePlus, Trash2 } from 'lucide-react'

export default function SchoolConfigPage() {
 const qc = useQueryClient()
 const [form, setForm] = useState({})
 const [saving, setSaving] = useState(false)

 const { data, isLoading } = useQuery({
 queryKey: ['school-config'],
 queryFn: () => api.get('/config').then(r => r.data.data),
 staleTime: 0,
 })

 useEffect(() => { if (data) setForm(data) }, [data])

 const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

 // ── School logo ───────────────────────────────────────────────
 const readAsDataURL = (file) => new Promise((resolve, reject) => {
 const r = new FileReader()
 r.onload = () => resolve(r.result)
 r.onerror = () => reject(new Error('Could not read the file.'))
 r.readAsDataURL(file)
 })

 const handleLogoFile = async (e) => {
 const file = e.target.files?.[0]
 e.target.value = '' // allow picking the same file again
 if (!file) return
 if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type))
 return toast.error('Please choose a PNG, JPG, WEBP or SVG image.')
 if (file.size > 3 * 1024 * 1024)
 return toast.error('Image is too large. Please choose one under 3 MB.')
 try {
 const dataUrl = await readAsDataURL(file)
 if (file.type === 'image/svg+xml') {
 if (dataUrl.length > 500000) return toast.error('SVG is too large (max ~350 KB).')
 return setForm(p => ({ ...p, school_logo: dataUrl }))
 }
 // Shrink to max 256px so it stays small but sharp enough for the tab icon
 const img = await new Promise((resolve, reject) => {
 const i = new Image()
 i.onload = () => resolve(i)
 i.onerror = () => reject(new Error('Invalid image.'))
 i.src = dataUrl
 })
 const scale = Math.min(1, 256 / Math.max(img.width, img.height))
 const canvas = document.createElement('canvas')
 canvas.width = Math.round(img.width * scale)
 canvas.height = Math.round(img.height * scale)
 canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
 setForm(p => ({ ...p, school_logo: canvas.toDataURL('image/png') }))
 } catch (err) {
 toast.error(err.message || 'Failed to load image.')
 }
 }

 const removeLogo = () => setForm(p => ({ ...p, school_logo: '' }))

 const handleSave = async () => {
 setSaving(true)
 try {
 await api.put('/config', form)
 toast.success('Configuration saved successfully.')
 qc.invalidateQueries({ queryKey: ['school-config'] })
 qc.invalidateQueries({ queryKey: ['branding'] })
 } catch (err) {
 toast.error(err.response?.data?.message || 'Failed to save.')
 } finally {
 setSaving(false)
 }
 }

 const groups = [
 {
 icon: School,
 label: 'School Information',
 color: 'text-blue-600 bg-blue-50',
 fields: [
 { key: 'school_name', label: 'School Name', type: 'text', placeholder: 'e.g. Bagong Senior High School' },
 { key: 'school_address', label: 'School Address', type: 'text', placeholder: 'Municipality, Province' },
 ],
 },
 {
 icon: Calendar,
 label: 'Academic Year',
 color: 'text-purple-600 bg-purple-50',
 fields: [
 { key: 'school_year', label: 'School Year', type: 'text', placeholder: 'e.g. 2025-2026' },
 { key: 'semester', label: 'School Term', type: 'select', options: ['1st Term', '2nd Term', '3rd Term', 'Summer'] },
 ],
 },
 {
 icon: BookOpen,
 label: 'Grading Rules',
 color: 'text-emerald-600 bg-emerald-50',
 fields: [
 { key: 'grade_passing', label: 'Passing Grade', type: 'number', placeholder: '75' },
 { key: 'attendance_threshold', label: 'Max Absences Before Alert', type: 'number', placeholder: '3' },
 ],
 },
 ]

 return (
 <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
 <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
 <div>
 <h1 className="page-title">School Configuration</h1>
 <p className="text-slate-500 text-sm mt-1">System-wide settings for the current school year</p>
 </div>
 <button onClick={handleSave} disabled={saving} className="btn-primary">
 {saving
 ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>
 : <><Save size={15}/> Save All Changes</>
 }
 </button>
 </div>

 {isLoading ? (
 <div className="flex justify-center py-16">
<PageSkeleton/>
 </div>
 ) : (
 <div className="space-y-5">
 <div className="card p-6">
 <div className="flex items-center gap-3 mb-5">
 <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-amber-600 bg-amber-50">
 <ImagePlus size={16}/>
 </div>
 <div>
 <h3 className="font-display font-bold text-slate-900">School Logo</h3>
 <p className="text-xs text-slate-400 mt-0.5">Shown on the login page, sidebar and browser tab</p>
 </div>
 </div>
 <div className="flex items-center gap-5 flex-wrap">
 <div className="w-20 h-20 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
 {form.school_logo
 ? <img src={form.school_logo} alt="School logo preview" className="w-full h-full object-contain p-1"/>
 : <School size={28} className="text-slate-300"/>}
 </div>
 <div className="space-y-2">
 <div className="flex gap-2 flex-wrap">
 <label className="btn-primary cursor-pointer">
 <ImagePlus size={15}/> {form.school_logo ? 'Change Logo' : 'Upload Logo'}
 <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoFile}/>
 </label>
 {form.school_logo && (
 <button type="button" onClick={removeLogo} className="btn-secondary">
 <Trash2 size={15}/> Remove
 </button>
 )}
 </div>
 <p className="text-xs text-slate-400">PNG, JPG, WEBP or SVG. A square image works best. Click <strong>Save All Changes</strong> to apply.</p>
 </div>
 </div>
 </div>
 {groups.map(group => (
 <div key={group.label} className="card p-6">
 <div className="flex items-center gap-3 mb-5">
 <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${group.color}`}>
 <group.icon size={16}/>
 </div>
 <h3 className="font-display font-bold text-slate-900">{group.label}</h3>
 </div>
 <div className="grid sm:grid-cols-2 gap-4">
 {group.fields.map(f => (
 <div key={f.key}>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">{f.label}</label>
 {f.type === 'select' ? (
 <select className="input-field"value={form[f.key] || ''} onChange={set(f.key)}>
 {f.options.map(o => <option key={o} value={o}>{o}</option>)}
 </select>
 ) : (
 <input
 type={f.type}
 className="input-field"
 placeholder={f.placeholder}
 value={form[f.key] || ''}
 onChange={set(f.key)}
 />
 )}
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )
}
