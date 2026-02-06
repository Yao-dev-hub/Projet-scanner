/* eslint-disable @typescript-eslint/no-explicit-any */
// app/inventaires/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaClipboardList, FaBarcode, FaCalendarAlt } from 'react-icons/fa';
import { BsUpcScan } from "react-icons/bs";


interface Inventaire {
  id: number;
  date: string;
  createdAt: string;
  nbScans: number;
}

export default function InventairesPage() {
  const [inventaires, setInventaires] = useState<Inventaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Charger la liste des inventaires avec debug
  const loadInventaires = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Chargement des inventaires...');
      const res = await fetch('/api/inventaire');
      console.log('Statut réponse:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erreur HTTP ${res.status}: ${errorText}`);
      }

      const json = await res.json();
      console.log('Réponse JSON complète:', json);

      if (json.error) {
        throw new Error(json.error);
      }

      // Vérification que la clé existe
      const invList = json.inventaires || json.data || [];
      if (!Array.isArray(invList)) {
        throw new Error('Format inattendu : inventaires n’est pas un tableau');
      }

      setInventaires(invList);
    } catch (err: any) {
      console.error('Erreur complète lors du chargement:', err);
      setError(err.message || 'Impossible de charger les inventaires');
      toast.error(err.message || 'Erreur lors du chargement des inventaires');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventaires();
  }, []);

  // Créer un nouvel inventaire et rediriger
  const createNewInventaire = async () => {
    try {
      const res = await fetch('/api/inventaire', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success(json.message || `Nouvel inventaire #${json.id} créé !`, { autoClose: 2000 });

      // Rafraîchir la liste
      await loadInventaires();

      // Rediriger vers scanner avec le nouvel ID
      router.push(`/scan?inventaireId=${json.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création de l’inventaire');
    }
  };

  // Stats des cards
  const totalInventaires = inventaires.length;
  const totalScans = inventaires.reduce((sum, inv) => sum + (inv.nbScans || 0), 0);
  const dernierInventaire = inventaires[0] || null; // Le plus récent en premier

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-gray-950 to-black flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-4 border-emerald-500 rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-xl font-medium">Chargement des inventaires...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-b p-30 from-gray-950 to-black flex items-center justify-center text-white  ">
        <div className="text-center max-w-md">
          <h1 className="text-5xl font-bold text-red-500 mb-6">Oups !</h1>
          <p className="text-2xl mb-8">{error}</p>
          <button
            onClick={loadInventaires}
            className="bg-emerald-600 hover:bg-emerald-700 px-10 py-5 rounded-xl text-lg font-bold shadow-lg transition"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen  bg-linear-to-b from-gray-950 via-gray-900 to-black text-white p-20">
      <ToastContainer theme="dark" position="top-center" />

      <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-lg border-b border-gray-800/50 py-4 mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold bg-linear-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent text-center">
            Dashboard Inventaires
          </h1>
        </div>
      </header>

      {/* Cards statistiques en haut */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <div className="bg-gray-900/60 backdrop-blur-md p-6 rounded-2xl border border-emerald-500/30 shadow-xl flex items-center gap-5">
          <div className="bg-emerald-500/20 p-4 rounded-xl">
            <FaClipboardList className="text-emerald-400 text-4xl" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Total Inventaires</p>
            <p className="text-4xl font-bold text-emerald-400">{totalInventaires}</p>
          </div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-md p-6 rounded-2xl border border-blue-500/30 shadow-xl flex items-center gap-5">
          <div className="bg-blue-500/20 p-4 rounded-xl">
            <FaBarcode className="text-blue-400 text-4xl" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Total Scans</p>
            <p className="text-4xl font-bold text-blue-400">{totalScans}</p>
          </div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-md p-6 rounded-2xl border border-purple-500/30 shadow-xl flex items-center gap-5">
          <div className="bg-purple-500/20 p-4 rounded-xl">
            <FaCalendarAlt className="text-purple-400 text-4xl" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Dernier Inventaire</p>
            {dernierInventaire ? (
              <div>
                <p className="text-xl font-bold text-purple-400">
                  #{dernierInventaire.id} - {new Date(dernierInventaire.createdAt).toLocaleDateString('fr-FR')}
                </p>
                <p className="text-sm text-gray-300">{dernierInventaire.nbScans} scans</p>
              </div>
            ) : (
              <p className="text-xl font-bold text-purple-400">Aucun</p>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto flex flex-col gap-6 justify-center items-center">
        {/* Bouton créer */}
        <div className="mb-8 text-center ">
          <button
            onClick={createNewInventaire}
            className="flex justify-center items-center bg-linear-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 px-6 py-2 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
          >
           <BsUpcScan className="mr-2" />Créer un nouvel inventaire
          </button>
        </div>

        {inventaires.length === 0 ? (
          <p className="text-center text-gray-400 text-xl">Aucun inventaire disponible</p>
        ) : (
          <div className="w-full overflow-x-auto rounded-2xl border border-gray-700 shadow-2xl bg-gray-900/40 backdrop-blur-sm">
            <table className="w-full text-sm sm:text-base">
              <thead className="bg-gray-800/90 sticky top-0">
                <tr>
                  <th className="p-4 text-left font-semibold">ID</th>
                  <th className="p-4 text-left font-semibold">Date création</th>
                  <th className="p-4 text-center font-semibold">Nb scans</th>
                  <th className="p-4 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventaires.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                    <td className="p-4 font-semibold"># {inv.id}</td>
                    <td className="p-4">
                      {new Date(inv.createdAt).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="p-4 text-center font-bold text-emerald-400">{inv.nbScans}</td>
                    <td className="p-4 text-center flex justify-center gap-4">
                      <Link
                        href={`/resume?inventaireId=${inv.id}`}
                        className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl font-semibold shadow-lg transition text-sm"
                      >
                        Voir détails
                      </Link>
                      <Link
                        href={`/scan?inventaireId=${inv.id}`}
                        className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl font-semibold shadow-lg transition text-sm"
                      >
                        Scanner
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}