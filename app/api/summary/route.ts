/* eslint-disable @typescript-eslint/no-explicit-any */
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
      // Fallback : dernier inventaire du jour
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
      select: { barcode: true, depot: true },
    });

    if (scans.length === 0) {
      return NextResponse.json({
        produits: [],
        grandTotalA: 0,
        grandTotalB: 0,
        grandTotal: 0,
        date: new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        message: 'Aucun appareil scanné dans cet inventaire',
        inventaireId,
      });
    }

    // Récupère les produits scannés
    const barcodes = scans.map(s => s.barcode);
    const produits = await prisma.produit.findMany({
      where: { barcode: { in: barcodes } },
      select: {
        barcode: true,
        model: true,
        capacity: true,
        couleur: true,
        depot: true,
        quantite: true,
      },
    });

    // Groupement par combinaison exacte
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

    // Calcul des grands totaux
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






// /* eslint-disable @typescript-eslint/no-explicit-any */
// // app/api/summary/route.ts
// import { prisma } from '@/lib/prisma';
// import { NextResponse } from 'next/server';

// export async function GET(request: Request) {
//   try {
//     // Optionnel : récupérer l'inventaire actif via query param (ou le dernier créé aujourd'hui)
//     const { searchParams } = new URL(request.url);
//     const inventaireIdParam = searchParams.get('inventaireId');

//     let inventaireId: number;

//     if (inventaireIdParam) {
//       inventaireId = Number(inventaireIdParam);
//     } else {
//       // Sinon on prend le dernier inventaire du jour (comme dans /api/inventaire)
//       const todayStart = new Date();
//       todayStart.setHours(0, 0, 0, 0);

//       const lastInventaire = await prisma.inventaire.findFirst({
//         where: { date: { gte: todayStart } },
//         orderBy: { createdAt: 'desc' },
//       });

//       if (!lastInventaire) {
//         return NextResponse.json({ error: 'Aucun inventaire actif aujourd’hui' }, { status: 404 });
//       }

//       inventaireId = lastInventaire.id;
//     }

//     // Récupère tous les scans de cet inventaire
//     const scans = await prisma.scan.findMany({
//       where: { inventaireId },
//       select: { barcode: true, depot: true },
//     });

//     if (scans.length === 0) {
//       return NextResponse.json({
//         produits: [],
//         grandTotalA: 0,
//         grandTotalB: 0,
//         grandTotal: 0,
//         date: new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
//         message: 'Aucun appareil scanné dans cet inventaire',
//       });
//     }

//     // Récupère les produits correspondant aux barcodes scannés
//     const barcodes = scans.map(s => s.barcode);
//     const produits = await prisma.produit.findMany({
//       where: { barcode: { in: barcodes } },
//       select: {
//         barcode: true,
//         model: true,
//         capacity: true,
//         couleur: true,
//         depot: true,
//         quantite: true,
//       },
//     });

//     // On associe chaque scan à son produit (pour garder le dépôt du scan si différent)
//     const produitsAvecDepotScan = scans.map(scan => {
//       const produit = produits.find(p => p.barcode === scan.barcode);
//       return {
//         ...produit,
//         depot: scan.depot, // on prend le dépôt choisi au moment du scan
//       };
//     });

//     // Groupement par combinaison
//     const grouped = produitsAvecDepotScan.reduce((acc: Record<string, any>, p) => {
//       const key = `${p.model || 'Inconnu'}-${p.capacity || 'Inconnu'}-${p.couleur || 'Inconnu'}-${p.depot || 'Inconnu'}`;

//       if (!acc[key]) {
//         acc[key] = {
//           model: p.model || 'Inconnu',
//           capacity: p.capacity || 'Inconnu',
//           couleur: p.couleur || 'Inconnu',
//           depot: p.depot || 'Inconnu',
//           quantiteTotale: 0,
//           nbAppareils: 0,
//         };
//       }

//       acc[key].quantiteTotale += Number(p.quantite) || 0;
//       acc[key].nbAppareils += 1;

//       return acc;
//     }, {});

//     // Totaux globaux
//     let grandTotalA = 0;
//     let grandTotalB = 0;
//     let grandTotalAppareils = 0;

//     Object.values(grouped).forEach((g: any) => {
//       if (g.depot === 'A') grandTotalA += g.quantiteTotale;
//       if (g.depot === 'B') grandTotalB += g.quantiteTotale;
//       grandTotalAppareils += g.nbAppareils;
//     });

//     const grandTotal = grandTotalA + grandTotalB;

//     return NextResponse.json({
//       produits: Object.values(grouped),
//       grandTotalA,
//       grandTotalB,
//       grandTotal,
//       grandTotalAppareils,
//       date: new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
//       inventaireId,
//     });
//   } catch (error) {
//     console.error('Erreur summary:', error);
//     return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
//   }
// }






// export async function GET() {
//   try {
//     // Récupère tous les produits
//     // Pour filtrer par inventaire actif, décommente et passe l'ID en query param plus tard
//     // const { searchParams } = new URL(request.url);
//     // const inventaireId = searchParams.get('inventaireId');
//     const produits = await prisma.produit.findMany({
//       select: {
//         model: true,
//         capacity: true,
//         couleur: true,
//         depot: true,
//         quantite: true,
//         prixUnitaire: true,
//       },
//       // where: inventaireId ? { inventaireId: Number(inventaireId) } : undefined,
//     });

//     // Groupement par combinaison exacte
//     const grouped = produits.reduce((acc: Record<string, {
//       model: string;
//       capacity: string;
//       couleur: string;
//       depot: string;
//       quantiteTotale: number;
//       valeurTotale: number;
//       nbAppareils: number;
//     }>, p) => {
//       const key = `${p.model || 'Inconnu'}-${p.capacity || 'Inconnu'}-${p.couleur || 'Inconnu'}-${p.depot || 'Inconnu'}`;

//       if (!acc[key]) {
//         acc[key] = {
//           model: p.model || 'Inconnu',
//           capacity: p.capacity || 'Inconnu',
//           couleur: p.couleur || 'Inconnu',
//           depot: p.depot || 'Inconnu',
//           quantiteTotale: 0,
//           valeurTotale: 0,
//           nbAppareils: 0,
//         };
//       }

//       acc[key].quantiteTotale += Number(p.quantite) || 0;
//       acc[key].valeurTotale += (Number(p.quantite) || 0) * (Number(p.prixUnitaire) || 0);
//       acc[key].nbAppareils += 1;

//       return acc;
//     }, {});

//     // Calcul des grands totaux
//     let grandTotalA = 0;
//     let grandTotalB = 0;
//     let grandTotalValeur = 0;
//     let grandTotalAppareils = 0;

//     Object.values(grouped).forEach(g => {
//       if (g.depot === 'A') grandTotalA += g.quantiteTotale;
//       if (g.depot === 'B') grandTotalB += g.quantiteTotale;
//       grandTotalValeur += g.valeurTotale;
//       grandTotalAppareils += g.nbAppareils;
//     });

//     const grandTotal = grandTotalA + grandTotalB;

//     return NextResponse.json({
//       produits: Object.values(grouped), // liste des groupes pour le tableau
//       grandTotalA,
//       grandTotalB,
//       grandTotal,
//       grandTotalValeur,
//       grandTotalAppareils,
//       date: new Date().toLocaleDateString('fr-FR', {
//         weekday: 'long',
//         year: 'numeric',
//         month: 'long',
//         day: 'numeric',
//       }),
//     });
//   } catch (error) {
//     console.error('Erreur summary:', error);
//     return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
//   }
// }