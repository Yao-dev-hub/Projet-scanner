// app/api/summary/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const inventaireIdParam = searchParams.get('inventaireId');

    let inventaireId: number;

    if (inventaireIdParam) {
      inventaireId = Number(inventaireIdParam);
      if (isNaN(inventaireId)) {
        return NextResponse.json({ error: 'ID inventaire invalide' }, { status: 400 });
      }
    } else {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const lastInventaire = await prisma.inventaire.findFirst({
        where: { date: { gte: todayStart } },
        orderBy: { createdAt: 'desc' },
      });

      if (!lastInventaire) {
        return NextResponse.json({ error: 'Aucun inventaire actif aujourd’hui' }, { status: 404 });
      }

      inventaireId = lastInventaire.id;
    }

    // Récupère les scans de cet inventaire
    const scans = await prisma.scan.findMany({
      where: { inventaireId },
      select: {
        barcode: true,
        depot: true,
        createdAt: true, // optionnel : date du scan si tu veux l'exporter
      },
    });

    if (scans.length === 0) {
      return NextResponse.json({
        produits: [],
        scans: [], // ← liste vide pour le front
        grandTotalA: 0,
        grandTotalB: 0,
        grandTotal: 0,
        date: new Date().toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        message: 'Aucun appareil scanné dans cet inventaire',
        inventaireId,
      });
    }

    // Récupère les produits scannés avec TOUS les champs utiles
    const barcodes = scans.map((s: { barcode: string }) => s.barcode);
    const produits = await prisma.produit.findMany({
      where: { barcode: { in: barcodes } },
      select: {
        barcode: true,
        marque: true,           // ← ajouté
        model: true,
        capacity: true,
        couleur: true,
        depot: true,            // ← c'est ton "grade"
        depotVente: true,       // ← si tu veux l'exporter
        quantite: true,
        prixUnitaire: true,     // ← ajouté
        description: true,      // ← ajouté si tu veux
      },
    });

    // Associe chaque scan à son produit complet
    const scansAvecDetails = scans.map(scan => {
      const produit = produits.find(p => p.barcode === scan.barcode);
      return {
        barcode: scan.barcode,
        marque: produit?.marque || 'N/A',
        model: produit?.model || 'Inconnu',
        capacity: produit?.capacity || 'Inconnu',
        couleur: produit?.couleur || 'Inconnu',
        depot: scan.depot || produit?.depot || 'Inconnu', // priorité au scan, sinon produit
        depotVente: produit?.depotVente || 'N/A',
        quantite: produit?.quantite || 1,
        prixUnitaire: produit?.prixUnitaire || null,
        description: produit?.description || null,
        dateScan: scan.createdAt.toISOString(), // ← date du scan
      };
    });

    // Groupement pour le tableau (inchangé)
    const grouped = produits.reduce((acc: Record<string, {
      model: string;
      capacity: string;
      couleur: string;
      depot: string;
      quantiteTotale: number;
      nbAppareils: number;
    }>, p) => {
      const key = `${p.model || 'Inconnu'}-${p.capacity || 'Inconnu'}-${p.couleur || 'Inconnu'}-${p.depot || 'Inconnu'}`;

      if (!acc[key]) {
        acc[key] = {
          model: p.model || 'Inconnu',
          capacity: p.capacity || 'Inconnu',
          couleur: p.couleur || 'Inconnu',
          depot: p.depot || 'Inconnu',
          quantiteTotale: 0,
          nbAppareils: 0,
        };
      }

      acc[key].quantiteTotale += Number(p.quantite) || 0;
      acc[key].nbAppareils += 1;

      return acc;
    }, {});

    // Calcul des grands totaux (inchangé)
    let grandTotalA = 0;
    let grandTotalB = 0;
    let grandTotalAppareils = 0;

    Object.values(grouped).forEach(g => {
      if (g.depot === 'A') grandTotalA += g.quantiteTotale;
      if (g.depot === 'B') grandTotalB += g.quantiteTotale;
      grandTotalAppareils += g.nbAppareils;
    });

    const grandTotal = grandTotalA + grandTotalB;

    return NextResponse.json({
      produits: Object.values(grouped),
      scans: scansAvecDetails,  // ← liste brute pour Excel (chaque scan = 1 ligne)
      grandTotalA,
      grandTotalB,
      grandTotal,
      grandTotalAppareils,
      date: new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      inventaireId,
    });
  } catch (error) {
    console.error('Erreur summary:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}