/* eslint-disable @typescript-eslint/no-explicit-any */
// app/resume/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ────────────────────────────────────────────────
// Interfaces pour un typage strict
// ────────────────────────────────────────────────

interface GroupedProduit {
  model: string;
  capacity: string;
  couleur: string;
  depot: string;
  quantiteTotale: number;
  nbAppareils: number;
}

interface SummaryResponse {
  produits: GroupedProduit[];
  grandTotalA: number;
  grandTotalB: number;
  grandTotal: number;
  date: string;
  inventaireId?: number; // Optionnel, ajouté par l'API
}

// ────────────────────────────────────────────────
// Composant principal
// ────────────────────────────────────────────────

export default function ResumePage() {
  const searchParams = useSearchParams();
  const inventaireId = searchParams.get('inventaireId');

  const [inventaire, setInventaire] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResume = async () => {
      try {
        let url = '/api/summary';
        if (inventaireId) {
          url += `?inventaireId=${inventaireId}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json: unknown = await res.json();

        // Vérification sécurisée
        if (json && typeof json === 'object' && 'error' in json) {
          throw new Error((json as { error: string }).error);
        }

        const data = json as SummaryResponse;
        setInventaire(data);
      } catch (err: any) {
        setError(err.message || 'Impossible de charger l’inventaire');
      } finally {
        setLoading(false);
      }
    };

    fetchResume();
  }, [inventaireId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-4 border-emerald-500 rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-xl font-medium">Chargement de l’inventaire...</p>
        </div>
      </div>
    );
  }

  if (error || !inventaire) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black flex items-center justify-center text-white p-6">
        <div className="text-center max-w-md">
          <h1 className="text-5xl font-bold text-red-500 mb-6">Oups !</h1>
          <p className="text-2xl mb-8">{error || 'Aucun appareil scanné dans cet inventaire'}</p>
          <Link href="/scan" className="inline-block bg-emerald-600 px-10 py-5 rounded-xl hover:bg-emerald-700 text-lg font-bold shadow-lg transition">
            Retour au scanner
          </Link>
        </div>
      </div>
    );
  }

  const produits: GroupedProduit[] = Array.isArray(inventaire.produits) ? inventaire.produits : [];
  const date: string = inventaire.date || new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const totalA: number = Number(inventaire.grandTotalA) || 0;
  const totalB: number = Number(inventaire.grandTotalB) || 0;
  const totalGeneral: number = Number(inventaire.grandTotal) || 0;

  // Re-groupement par (model, capacity, couleur) pour matcher l'image
  const regrouped = produits.reduce((acc: Record<string, any>, p: GroupedProduit) => {
    const key = `${p.model}-${p.capacity}-${p.couleur}`;

    if (!acc[key]) {
      acc[key] = {
        model: p.model,
        capacity: p.capacity,
        couleur: p.couleur,
        countA: 0,
        totalA: 0,
        countB: 0,
        totalB: 0,
        countVente: 0,
        totalVente: 0,
      };
    }

    if (p.depot === 'A') {
      acc[key].countA += p.nbAppareils;
      acc[key].totalA += p.quantiteTotale;
    } else if (p.depot === 'B') {
      acc[key].countB += p.nbAppareils;
      acc[key].totalB += p.quantiteTotale;
    } else if (p.depot === 'Vente') {
      acc[key].countVente += p.nbAppareils;
      acc[key].totalVente += p.quantiteTotale;
    }

    return acc;
  }, {});

  // Fonction pour générer et télécharger le PDF
  const downloadPDF = () => {
    const doc = new jsPDF();

    // Titre avec ID
    doc.setFontSize(18);
    doc.text(`Résumé Inventaire #${inventaireId || 'Actuel'}`, 20, 20);

    // Date
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Date : ${date}`, 20, 30);

    // Totaux
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Totaux :', 20, 45);

    doc.setFontSize(12);
    doc.text(`Dépôt A : ${totalA}`, 20, 55);
    doc.text(`Dépôt B : ${totalB}`, 20, 62);
    doc.text(`Total général : ${totalGeneral}`, 20, 69);

    // Tableau
    if (Object.keys(regrouped).length > 0) {
      const tableColumn = ['Modèle', 'Capacité', 'Couleur', 'A', 'Total A', 'B', 'Total dépôt vente', 'Dépôt vente', 'Total B', 'Total'];
      const tableRows = Object.values(regrouped).map((group: any) => [
        group.model,
        group.capacity,
        group.couleur,
        group.countA,
        group.totalA,
        group.countB,
        group.totalVente,
        group.countVente,
        group.totalB,
        group.totalA + group.totalB + group.totalVente,
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 80,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [34, 197, 94], textColor: 255 },
        alternateRowStyles: { fillColor: [240, 240, 240] },
      });
    }

    // Pied de page
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} - Page ${i} / ${pageCount}`, 20, doc.internal.pageSize.height - 10);
    }

    doc.save(`Inventaire_${inventaireId || 'Actuel'}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white p-15">
      {/* En-tête */}
      <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-lg rounded-2xl py-4 border-2 border-gray-700/50 shadow-2xl mb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
              Résumé Inventaire {inventaireId ? `#${inventaireId}` : ''}
            </h1>
            <p className="text-lg text-gray-300 capitalize">{date}</p>
          </div>

          {/* Totaux */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="bg-gray-900/60 backdrop-blur-md p-6 rounded-2xl border border-emerald-500/30 shadow-xl">
              <p className="text-sm text-gray-400 mb-1">Dépôt A</p>
              <p className="text-4xl font-bold text-emerald-400">{totalA}</p>
            </div>
            <div className="bg-gray-900/60 backdrop-blur-md p-6 rounded-2xl border border-blue-500/30 shadow-xl">
              <p className="text-sm text-gray-400 mb-1">Dépôt B</p>
              <p className="text-4xl font-bold text-blue-400">{totalB}</p>
            </div>
            <div className="bg-gray-900/60 backdrop-blur-md p-6 rounded-2xl border border-yellow-500/30 shadow-xl">
              <p className="text-sm text-gray-400 mb-1">Total général</p>
              <p className="text-4xl font-bold text-yellow-400">{totalGeneral}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tableau */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {produits.length === 0 ? (
          <p className="text-center text-gray-400 text-xl">Aucun appareil scanné dans cet inventaire</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-700 shadow-2xl bg-gray-900/40 backdrop-blur-sm">
            <table className="w-full text-sm sm:text-base">
              <thead className="bg-gray-800/90 sticky top-0">
                <tr>
                  <th className="p-4 text-left font-semibold">Modèle</th>
                  <th className="p-4 text-left font-semibold">Capacité</th>
                  <th className="p-4 text-left font-semibold">Couleur</th>
                  <th className="p-4 text-center font-semibold">A</th>
                  <th className="p-4 text-center font-semibold">Total A</th>
                  <th className="p-4 text-center font-semibold">B</th>
                  <th className="p-4 text-center font-semibold">Total dépôt vente</th>
                  <th className="p-4 text-center font-semibold">Dépôt vente</th>
                  <th className="p-4 text-center font-semibold">Total B</th>
                  <th className="p-4 text-center font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(regrouped).map((group: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                    <td className="p-4 font-semibold">{group.model}</td>
                    <td className="p-4">{group.capacity}</td>
                    <td className="p-4">{group.couleur}</td>
                    <td className="p-4 text-center">{group.countA}</td>
                    <td className="p-4 text-center font-bold text-emerald-400">{group.totalA}</td>
                    <td className="p-4 text-center">{group.countB}</td>
                    <td className="p-4 text-center">{group.totalVente}</td>
                    <td className="p-4 text-center">{group.countVente}</td>
                    <td className="p-4 text-center font-bold text-blue-400">{group.totalB}</td>
                    <td className="p-4 text-center font-bold text-yellow-400">{group.totalA + group.totalB + group.totalVente}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-900 font-bold">
                <tr>
                  <td colSpan={3} className="p-5 text-right text-lg">Totaux :</td>
                  <td className="p-5 text-center"></td>
                  <td className="p-5 text-center text-yellow-400 text-2xl">{totalGeneral}</td>
                  <td className="p-5 text-center"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Boutons */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={`/scan?inventaireId=${inventaireId}`}
            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 px-5 py-3 rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 text-center"
          >
            Continuer à scanner
          </Link>

          <button
            onClick={async () => {
              if (!confirm('Vider cet inventaire ? Cette action est irréversible.')) return;
              try {
                await fetch('/api/reset', { method: 'POST' });
                window.location.reload();
              } catch {
                alert('Erreur lors du vidage');
              }
            }}
            className="bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 px-5 py-3 rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 text-center"
          >
            Vider l’inventaire
          </button>

          {/* Bouton Télécharger PDF */}
          {produits.length > 0 && (
            <button
              onClick={downloadPDF}
              className="bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 px-5 py-3 rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 text-center flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Télécharger PDF
            </button>
          )}
        </div>
      </main>
    </div>
  );
}