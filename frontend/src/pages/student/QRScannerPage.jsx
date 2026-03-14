import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import api from '../../api/client'
import toast from 'react-hot-toast'
import { QrCode, CheckCircle, XCircle, Camera } from 'lucide-react'

export default function QRScannerPage() {
  const scannerRef  = useRef(null)
  const html5QrRef  = useRef(null)
  const [scanning,  setScanning]  = useState(false)
  const [result,    setResult]    = useState(null) // { status, message }
  const [loading,   setLoading]   = useState(false)

  const startScanner = async () => {
    setResult(null)
    try {
      const html5Qr = new Html5Qrcode('qr-reader')
      html5QrRef.current = html5Qr

      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          // Stop scanner immediately after first scan
          await html5Qr.stop()
          setScanning(false)
          await submitScan(decodedText)
        },
        () => {} // ignore errors during scan
      )
      setScanning(true)
    } catch (err) {
      toast.error('Could not access camera. Please allow camera permission.')
      console.error(err)
    }
  }

  const stopScanner = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop() } catch {}
    }
    setScanning(false)
  }

  const submitScan = async (token) => {
    setLoading(true)
    try {
      const res = await api.post('/attendance/scan', { token })
      setResult({ ok: true, message: res.data.message, status: res.data.data?.status })
      toast.success(res.data.message)
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to record attendance.'
      setResult({ ok: false, message: msg })
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => () => { stopScanner() }, [])

  return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="page-title">Scan QR Attendance</h1>
        <p className="text-slate-500 text-sm mt-1">Point your camera at the teacher's QR code to mark your attendance.</p>
      </div>

      <div className="card overflow-hidden">
        {/* Camera viewfinder */}
        <div className="relative bg-slate-900 aspect-square flex items-center justify-center">
          <div id="qr-reader" ref={scannerRef} className="w-full h-full" />

          {!scanning && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center">
                <Camera size={36} className="text-white/60" />
              </div>
              <p className="text-white/60 text-sm font-medium">Camera inactive</p>
            </div>
          )}

          {/* Corner guides */}
          {scanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-52 h-52">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-white rounded-tl-lg" style={{borderWidth:'3px'}} />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-white rounded-tr-lg" style={{borderWidth:'3px'}} />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-white rounded-bl-lg" style={{borderWidth:'3px'}} />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-white rounded-br-lg" style={{borderWidth:'3px'}} />
                <div className="absolute inset-0 border border-white/20" />
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="p-5">
          {/* Result */}
          {result && (
            <div className={`mb-4 p-4 rounded-xl flex items-start gap-3 ${result.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {result.ok
                ? <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                : <XCircle    size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              }
              <div>
                <p className={`font-bold text-sm ${result.ok ? 'text-green-800' : 'text-red-800'}`}>{result.message}</p>
                {result.ok && result.status && (
                  <p className="text-xs text-green-600 mt-0.5 capitalize">Status: <strong>{result.status}</strong></p>
                )}
              </div>
            </div>
          )}

          <button
            onClick={scanning ? stopScanner : startScanner}
            disabled={loading}
            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              scanning
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-primary hover:bg-primary-700 text-white'
            }`}
          >
            <QrCode size={18} />
            {scanning ? 'Stop Scanner' : result ? 'Scan Again' : 'Start Camera & Scan'}
          </button>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-1">How to scan:</p>
            <ol className="text-xs text-blue-600 space-y-0.5 list-decimal list-inside">
              <li>Tap "Start Camera & Scan"</li>
              <li>Allow camera permission if asked</li>
              <li>Point at your teacher's QR code</li>
              <li>Wait for automatic detection</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
