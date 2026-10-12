// ExamSheetPage.jsx — printable question paper + answer sheet (QR identifies the exam when scanned)
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { ArrowLeft, Printer } from 'lucide-react'

const SECTIONS = {
  mcq:   { title: 'Multiple Choice',         hint: 'Choose the letter of the best answer.' },
  tf:    { title: 'True or False',           hint: 'Write TRUE if the statement is correct, FALSE if it is not.' },
  mtf:   { title: 'Modified True or False',  hint: 'Write TRUE if the statement is correct. If FALSE, write the word that replaces the underlined part.' },
  ident: { title: 'Identification',          hint: 'Write the correct answer on the line.' },
  enum:  { title: 'Enumeration',             hint: 'List the items asked for.' },
  essay: { title: 'Essay / Problem Solving', hint: 'Answer completely. Show your solution when needed.' },
}
const ORDER = ['mcq', 'tf', 'mtf', 'ident', 'enum', 'essay']
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI']

// "The [[sun]] is cold" -> The <u>sun</u> is cold
const withUnderline = (text) =>
  String(text).split(/(\[\[.+?\]\])/g).map((p, i) =>
    /^\[\[.+\]\]$/.test(p) ? <u key={i} className="font-semibold">{p.slice(2, -2)}</u> : <span key={i}>{p}</span>)

const Bubble = ({ children }) => (
  <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border border-black text-[10px] mx-0.5 leading-none">{children}</span>
)

function groups(questions) {
  return ORDER.map(type => ({ type, items: questions.filter(q => q.type === type).map(q => ({ q, n: questions.indexOf(q) + 1 })) }))
    .filter(g => g.items.length)
}

function Header({ exam, extra }) {
  return (
    <div className="border-b-2 border-black pb-2 mb-3">
      <div className="flex justify-between gap-4">
        <div>
          <p className="text-lg font-bold">{exam.title}</p>
          <p className="text-xs">{[exam.subject_label, exam.section_label].filter(Boolean).join(' · ')}</p>
        </div>
        {extra}
      </div>
      <div className="grid grid-cols-3 gap-4 text-xs mt-3">
        <p>Name: <span className="inline-block border-b border-black w-44 align-bottom">&nbsp;</span></p>
        <p>Section: <span className="inline-block border-b border-black w-24 align-bottom">&nbsp;</span></p>
        <p>Date: <span className="inline-block border-b border-black w-24 align-bottom">&nbsp;</span></p>
      </div>
    </div>
  )
}

function QuestionPaper({ exam }) {
  return (
    <div className="text-[13px] leading-snug">
      <Header exam={exam} extra={<p className="text-xs font-semibold">Total: {Number(exam.total_points)} pts</p>} />
      {exam.instructions && <p className="text-xs italic mb-3">{exam.instructions}</p>}
      {groups(exam.questions).map((g, gi) => (
        <div key={g.type} className="mb-4" style={{ breakInside: 'avoid-page' }}>
          <p className="font-bold text-sm">{ROMAN[gi]}. {SECTIONS[g.type].title}
            <span className="font-normal text-xs"> — {SECTIONS[g.type].hint}</span></p>
          <div className="mt-2 space-y-2">
            {g.items.map(({ q, n }) => (
              <div key={q.id} style={{ breakInside: 'avoid' }}>
                <p><b>{n}.</b> {withUnderline(q.prompt)} <span className="text-[10px] text-slate-500">({Number(q.points)} pt{Number(q.points) === 1 ? '' : 's'})</span></p>
                {q.type === 'mcq' && (
                  <div className="grid grid-cols-2 gap-x-6 ml-5 text-[12px]">
                    {(q.choices || []).map((c, i) => <p key={i}>{String.fromCharCode(65 + i)}. {c}</p>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function AnswerSheet({ exam, qr }) {
  return (
    <div className="text-[13px]">
      <Header exam={exam} extra={
        <div className="text-center flex-shrink-0">
          {qr ? <img src={qr} alt="Exam QR" className="w-20 h-20" /> : <div className="w-20 h-20 bg-slate-100" />}
          <p className="text-[9px]">Scan to grade</p>
        </div>} />
      <p className="text-[11px] mb-3">Shade or write your answers below. Score: ______ / {Number(exam.total_points)}</p>
      {groups(exam.questions).map((g, gi) => (
        <div key={g.type} className="mb-4" style={{ breakInside: 'avoid-page' }}>
          <p className="font-bold text-sm mb-1">{ROMAN[gi]}. {SECTIONS[g.type].title}</p>
          <div className={g.type === 'mcq' || g.type === 'tf' ? 'columns-2 gap-8' : 'space-y-2'}>
            {g.items.map(({ q, n }) => {
              if (q.type === 'mcq') return (
                <p key={q.id} className="py-0.5" style={{ breakInside: 'avoid' }}>
                  <b className="inline-block w-6">{n}.</b>
                  {(q.choices || []).map((_, i) => <Bubble key={i}>{String.fromCharCode(65 + i)}</Bubble>)}
                </p>)
              if (q.type === 'tf') return (
                <p key={q.id} className="py-0.5" style={{ breakInside: 'avoid' }}>
                  <b className="inline-block w-6">{n}.</b><Bubble>T</Bubble><Bubble>F</Bubble>
                </p>)
              if (q.type === 'mtf') return (
                <p key={q.id}><b>{n}.</b> <Bubble>T</Bubble><Bubble>F</Bubble>
                  <span className="text-[11px] ml-2">If false, correct word:</span>
                  <span className="inline-block border-b border-black w-40 align-bottom ml-1">&nbsp;</span></p>)
              if (q.type === 'ident') return (
                <p key={q.id}><b>{n}.</b> <span className="inline-block border-b border-black w-72 align-bottom">&nbsp;</span></p>)
              if (q.type === 'enum') {
                const k = (q.answer?.items || []).length || 1
                return (
                  <div key={q.id} style={{ breakInside: 'avoid' }}>
                    <p><b>{n}.</b> <span className="text-[11px]">list {k} item{k === 1 ? '' : 's'}</span></p>
                    {Array.from({ length: k }).map((_, i) => (
                      <p key={i} className="ml-5">{i + 1}. <span className="inline-block border-b border-black w-64 align-bottom">&nbsp;</span></p>
                    ))}
                  </div>)
              }
              return (
                <div key={q.id} style={{ breakInside: 'avoid' }}>
                  <p><b>{n}.</b> <span className="text-[11px]">({Number(q.points)} pts)</span></p>
                  <div className="border border-black h-28 ml-5" />
                </div>)
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ExamSheetPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [tab, setTab] = useState('answer')
  const { data: exam, isLoading } = useQuery({ queryKey: ['exam', id], queryFn: () => api.get(`/exams/${id}`).then(r => r.data.data) })
  const { data: qr } = useQuery({ queryKey: ['exam-qr', id], queryFn: () => api.get(`/exams/${id}/qr`).then(r => r.data.data.dataUrl) })

  if (isLoading) return <p className="p-8 text-sm text-slate-400">Loading…</p>
  if (!exam) return <p className="p-8 text-sm text-red-500">Exam not found.</p>

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .print-area, .print-area * { visibility: visible !important; }
        .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 12mm; background: white; color: black; }
        @page { size: A4; margin: 0; }
      }`}</style>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={() => nav('/exams')} className="p-2 hover:bg-slate-100 rounded-xl"><ArrowLeft size={18} /></button>
        <h1 className="text-lg font-bold text-slate-900">Print: {exam.title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {[['answer', 'Answer sheet'], ['paper', 'Question paper']].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === k ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>{label}</button>
            ))}
          </div>
          <button onClick={() => window.print()} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold flex items-center gap-2"><Printer size={15} /> Print</button>
        </div>
      </div>

      <div className="print-area bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        {tab === 'paper' ? <QuestionPaper exam={exam} /> : <AnswerSheet exam={exam} qr={qr} />}
      </div>
    </div>
  )
}
