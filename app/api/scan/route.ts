/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/scan/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { barcode: rawBarcode, inventaireId } = body;

    // Nettoyage agressif du barcode
    const barcode = rawBarcode?.trim()?.replace(/[^0-9]/g, '');

    if (!barcode || barcode.length < 8) {
      return NextResponse.json({ error: 'Code-barres invalide (minimum 8 chiffres)' }, { status: 400 });
    }

    if (!inventaireId) {
      return NextResponse.json({ error: 'ID inventaire manquant' }, { status: 400 });
    }

    console.log('Scan reçu :', { barcode, inventaireId });

    // 1. Récupérer le produit existant dans la BD
    const produit = await prisma.produit.findUnique({
      where: { barcode },
    });

    if (!produit) {
      return NextResponse.json(
        { error: "Cet appareil n'est pas dans notre base de données" },
        { status: 404 }
      );
    }

    // 2. Vérifier si déjà scanné dans cet inventaire
    const scanExistant = await prisma.scan.findFirst({
      where: {
        barcode,
        inventaireId,
      },
    });

    if (scanExistant) {
      return NextResponse.json(
        { error: 'Appareil déjà scanné dans cet inventaire' },
        { status: 409 }
      );
    }

    // 3. Scan valide → on note le scan avec le dépôt qui vient de la BD
    await prisma.scan.create({
      data: {
        barcode,
        depot: produit.depot || 'Inconnu', // On prend le dépôt existant du produit
        inventaireId,
        createdAt: new Date(),
      },
    });
    console.log(`Scan enregistré : ${barcode} pour inventaire ${inventaireId}, mes infos du produit :  ${produit}`);
    // 4. Réponse succès avec les vraies infos du produit
    return NextResponse.json({
      success: true,
      produit,
      message: `+1 (${produit.model || 'Produit'} ${produit.capacity || ''})`,
    });
  } catch (error: any) {
    console.error('Erreur scan:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Conflit de clé unique (barcode déjà existant)' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}