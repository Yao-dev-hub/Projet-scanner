/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/scanner/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Quagga from '@ericblade/quagga2';
import { useRouter } from 'next/navigation';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function ScannerPage() {
  const [scannedCount, setScannedCount] = useState(0);
  const [currentInventaireId, setCurrentInventaireId] = useState<number | null>(null);
  const [depot, setDepot] = useState<'A' | 'B'>('A');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const router = useRouter();
  const isMounted = useRef(true);
  const quaggaInitialized = useRef(false);

  // Son de succès
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

  // Créer ou récupérer l'inventaire au montage
  useEffect(() => {
    const initInventaire = async () => {
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
  }, []);

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
              inputStream: { name: 'Live', type: 'LiveStream', target, constraints: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' } },
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

        // Détection + gestion des cas
        Quagga.onDetected(async (data) => {
          let code = data?.codeResult?.code?.trim();
          if (!code) return;

          code = code.replace(/[^0-9]/g, '');

          // Compteur temporaire (annulé si erreur)
          setScannedCount(prev => prev + 1);
          playSuccessBeep();
          if (navigator.vibrate) navigator.vibrate(150);

          try {
            const res = await fetch('/api/scan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                barcode: code,
                depot,
                inventaireId: currentInventaireId,
              }),
            });

            const json = await res.json();

            if (!res.ok) {
              // Erreur 404 : produit non trouvé dans la BD
              if (res.status === 404) {
                toast.error("🚫 Cet appareil n'est pas dans notre base de données", {
                  autoClose: 4000,
                  position: "top-center",
                  theme: "dark",
                });
              }
              // Erreur 409 : déjà scanné dans cet inventaire
              else if (res.status === 409) {
                toast.error("🚫 Appareil déjà scanné dans cet inventaire", {
                  autoClose: 4000,
                  position: "top-center",
                  theme: "dark",
                });
              }
              // Autre erreur
              else {
                toast.error(json.error || 'Erreur ajout', { autoClose: 1200 });
              }

              // Annule le compteur si erreur
              setScannedCount(prev => prev - 1);

              setTimeout(() => {
                if (isMounted.current) {
                  Quagga.start();
                  setIsScanning(true);
                }
              }, 600);

              return;
            }

            // Succès : produit trouvé et pas encore scanné dans cet inventaire
            toast.success(`✅ +1 (${json.produit.model || 'Produit'} ${json.produit.capacity || ''})`, {
              autoClose: 800,
              position: "top-center",
              theme: "dark",
            });

          } catch (err) {
            toast.error('Erreur réseau', { autoClose: 1200 });
            setScannedCount(prev => prev - 1);
          }

          // Re-démarre le scanner (succès ou erreur)
          setTimeout(() => {
            if (isMounted.current) {
              Quagga.start();
              setIsScanning(true);
            }
          }, 600);
        });

        // Overlay visuel
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
  }, [router, depot, currentInventaireId]);

  const restartScanner = () => {
    setScannedCount(0);
    setError('');
    setIsScanning(false);
  };

  return (
    <div className="h-screen bg-linear-to-b from-gray-950 to-gray-900 text-white flex flex-col overflow-hidden items-center justify-center p-5">
      <ToastContainer theme="dark" position="top-center" autoClose={800} hideProgressBar />

      {/* Compteur fixe en haut */}
      <div className="fixed top-25 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <div className="bg-black/80 backdrop-blur-lg px-4 py-1 rounded-full shadow-2xl border border-emerald-500/40">
          <p className="text-xl  font-bold text-white">
            Appareils scannés : <span className="text-emerald-400">{scannedCount}</span>
          </p>
        </div>
      </div>

      <div className="w-full max-w-md mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-center tracking-tight">
          Scanner Code-barres
        </h1>
      </div>

      {/* Choix dépôt - centré */}
      <div className="w-full max-w-md mb-6 flex justify-center gap-8">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="depot"
            value="A"
            checked={depot === 'A'}
            onChange={() => setDepot('A')}
            className="w-5 h-5 accent-emerald-500"
          />
          <span className="text-base font-medium">Dépôt A</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="depot"
            value="B"
            checked={depot === 'B'}
            onChange={() => setDepot('B')}
            className="w-5 h-5 accent-blue-500"
          />
          <span className="text-base font-medium">Dépôt B</span>
        </label>
      </div>

      {error && (
        <div className="w-full max-w-md bg-red-900/70 border border-red-600/50 text-red-100 p-4 rounded-xl mb-4 text-center shadow-lg">
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Zone de scan : carrée, très grande, centrée */}
      <div className="flex-1 flex items-center justify-center w-88 px-4">
        <div
          id="scanner-viewport"
          className={`relative w-full max-w-[85vw] aspect-square bg-black rounded-2xl overflow-hidden border-4 ${isScanning ? 'border-emerald-500' : 'border-gray-700'} shadow-2xl shadow-black/60 transition-all duration-300`}
        />
      </div>

      <div className="text-center mb-10">
        {isScanning ? (
          <p className="text-emerald-400 font-medium text-lg animate-pulse">Scanning actif...</p>
        ) : (
          <p className="text-amber-400 font-medium">Préparation du scanner...</p>
        )}
      </div>

      {/* Boutons fixes en bas (petits, centrés) */}
      <div className="fixed bottom-4 left-0 right-0 flex justify-center gap-4 px-4 z-50">
        <button
          onClick={() => router.push('/resume')}
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