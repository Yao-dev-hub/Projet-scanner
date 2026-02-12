/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Quagga from '@ericblade/quagga2';
import { useRouter, useSearchParams } from 'next/navigation';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


// Composant interne qui contient toute la logique (protégé par Suspense)
function ScanContent() {
  const searchParams = useSearchParams();
  const inventaireIdFromUrl = searchParams.get('inventaireId');

  const [scannedCount, setScannedCount] = useState(0);
  const [currentInventaireId, setCurrentInventaireId] = useState<number | null>(
    inventaireIdFromUrl ? Number(inventaireIdFromUrl) : null
  );
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const router = useRouter();
  const isMounted = useRef(true);
  const quaggaInitialized = useRef(false);

  // Son de succès (inchangé)
  const playSuccessBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(1800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  };

  // Si pas d'inventaireId dans l'URL, en créer un nouveau (inchangé)
  useEffect(() => {
    const initInventaire = async () => {
      if (currentInventaireId) return;

      try {
        const res = await fetch('/api/inventaire', { method: 'POST' });
        const data = await res.json();
        if (data.id) {
          setCurrentInventaireId(data.id);
          toast.info(`Inventaire #${data.id} démarré`, { autoClose: 1800 });
        }
      } catch {
        setError('Impossible de démarrer un inventaire');
      }
    };

    initInventaire();
  }, [currentInventaireId]);

  useEffect(() => {
    if (!currentInventaireId) return;

    const cleanup = () => {
      isMounted.current = false;
      if (quaggaInitialized.current) {
        Quagga.stop();
        Quagga.offDetected();
        Quagga.offProcessed();
        quaggaInitialized.current = false;
      }
    };

    const initAndStartScanner = async () => {
      setError('');
      setIsScanning(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Caméra non supportée. Utilisez HTTPS.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(t => t.stop());
      } catch (err: any) {
        setError(err.name === 'NotAllowedError' ? 'Accès caméra refusé' : 'Impossible d’accéder à la caméra');
        return;
      }

      const target = document.querySelector('#scanner-viewport');
      if (!target) {
        setError('Conteneur introuvable');
        return;
      }

      try {
        await new Promise<void>((resolve, reject) => {
          Quagga.init(
            {
              inputStream: { type: 'LiveStream', target, constraints: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' } },
              locator: { patchSize: 'medium', halfSample: true },
              numOfWorkers: navigator.hardwareConcurrency ? Math.min(4, navigator.hardwareConcurrency - 1) : 2,
              frequency: 12,
              decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'code_128_reader', 'code_39_reader'] },
              locate: true,
            },
            (err) => (err ? reject(err) : resolve())
          );
        });

        if (!isMounted.current) return;

        quaggaInitialized.current = true;
        Quagga.start();
        setIsScanning(true);

        // Détection + incrémentation conditionnelle
        Quagga.onDetected(async (data) => {
          let code = data?.codeResult?.code?.trim();
          if (!code) return;

          code = code.replace(/[^0-9]/g, '');

          try {
            const res = await fetch('/api/scan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                barcode: code,
                inventaireId: currentInventaireId,
              }),
            });

            const json = await res.json();

            if (!res.ok || json.error) {
              toast.error(json.error || 'Erreur ajout (déjà scanné ?)', { autoClose: 1200 });
              return;
            }

            setScannedCount(prev => prev + 1);
            playSuccessBeep();
            if (navigator.vibrate) navigator.vibrate(150);

            toast.success(`+1 (${json.produit.model} ${json.produit.capacity})`, { autoClose: 800 });
          } catch {
            toast.error('Erreur réseau', { autoClose: 1200 });
          }

          setTimeout(() => {
            if (isMounted.current) {
              Quagga.start();
              setIsScanning(true);
            }
          }, 600);
        });

        // Overlay visuel (inchangé)
        Quagga.onProcessed((result) => {
          const ctx = Quagga.canvas?.ctx?.overlay;
          const canvas = Quagga.canvas?.dom?.overlay;
          if (!ctx || !canvas) return;

          const w = parseInt(canvas.getAttribute('width') || '0');
          const h = parseInt(canvas.getAttribute('height') || '0');
          ctx.clearRect(0, 0, w, h);

          if (result?.boxes) {
            result.boxes.filter(b => b !== result.box).forEach(box => {
              Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, ctx, { color: 'rgba(0,255,0,0.4)', lineWidth: 2 });
            });
          }
          if (result?.box) {
            Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, ctx, { color: '#00aaff', lineWidth: 3 });
          }
          if (result?.codeResult?.code) {
            Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, ctx, { color: '#ff3366', lineWidth: 4 });
          }
        });
      } catch (err: any) {
        setError('Échec initialisation : ' + (err.message || 'Erreur'));
      }
    };

    const timer = setTimeout(initAndStartScanner, 300);

    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [router, currentInventaireId]);

  const restartScanner = () => {
    setScannedCount(0);
    setError('');
    setIsScanning(false);
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden items-center justify-center">
      <ToastContainer theme="colored" position="top-center" autoClose={800} hideProgressBar />

      {/* Compteur fixe en haut – gardé tel quel */}
      <div className="fixed top-15 left-55 right-0 z-50 flex justify-center pointer-events-none">
        <div className="bg-black/80 backdrop-blur-lg px-4 py-1 rounded-full shadow-2xl border border-emerald-500/40">
          <p className="text-xl font-bold text-white">
            Appareils scannés : <span className="text-emerald-400">{scannedCount}</span>
          </p>
        </div>
      </div>

      {/* <div className="w-full max-w-md my-5 text-center flex justify-center items-center">
        <h1 className="text-2xl font-bold text-center tracking-tight">
          Scanner Code-barres
        </h1>
      </div> */}

      {error && (
        <div className="w-full max-w-md bg-red-900/70 border border-red-600/50 text-red-100 p-4 rounded-xl mb-4 text-center shadow-lg">
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Zone de scan : carrée, très grande, centrée – gardée telle quelle */}
      <div className="flex-1 flex items-center justify-center w-100 px-4">
        <div
          id="scanner-viewport"
          className={`relative w-full max-w-[85vw] aspect-square bg-black rounded-2xl overflow-hidden border-4 ${isScanning ? 'border-emerald-500' : 'border-gray-700'} shadow-sm shadow-black/60 transition-all duration-300`}
        />
      </div>

      <div className="text-center mb-20">
        {isScanning ? (
          <p className="text-emerald-400 font-medium text-lg animate-pulse">Scanning actif...</p>
        ) : (
          <p className="text-amber-400 font-medium">Préparation du scanner...</p>
        )}
      </div>

      {/* Boutons fixes en bas – gardés tels quels */}
      <div className="fixed bottom-8 left-60  right-0 flex justify-center gap-4 px-4 z-50">
        <button
          onClick={() => router.push(`/resume?inventaireId=${currentInventaireId}`)}
          className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 rounded-xl font-semibold shadow-lg transition text-sm"
        >
          Voir le résumé
        </button>

        <button
          onClick={() => {
            if (confirm('Terminer cet inventaire ? Les totaux seront enregistrés.')) {
              router.push('/inventaires');
            }
          }}
          className="bg-green-600 hover:bg-green-700 px-6 py-2.5 rounded-xl font-semibold shadow-lg transition text-sm"
        >
          Terminer l’inventaire
        </button>
      </div>

      <style jsx global>{`
        html, body, #__next {
          height: 100%;
          overflow: hidden;
        }
        #scanner-viewport { position: relative; }
        #scanner-viewport canvas.drawingBuffer { position: absolute; inset: 0; width: 100%; height: 100%; }
        #scanner-viewport video { width: 100% !important; height: 100% !important; object-fit: cover; }
      `}</style>
    </div>
  );
}

// Page principale avec Suspense
export default function ScannerPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-background flex items-center justify-center text-foreground">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-t-4 border-emerald-500 rounded-full animate-spin mx-auto mb-6"></div>
            <p className="text-xl font-medium">Initialisation du scanner...</p>
          </div>
        </div>
      }
    >
      <ScanContent />
    </Suspense>
  );
}