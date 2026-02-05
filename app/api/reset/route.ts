// app/api/reset/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { inventaireId } = body; // Optionnel : reset seulement un inventaire précis

    // Reset de toutes les quantités (ou seulement pour un inventaire donné)
    await prisma.produit.updateMany({
      where: inventaireId ? { inventaireId } : undefined,
      data: {
        quantite: 0,
      },
    });

    // Optionnel : reset aussi les totaux dans l'inventaire concerné
    if (inventaireId) {
      await prisma.inventaire.update({
        where: { id: inventaireId },
        data: {
          totalA: 0,
          totalB: 0,
          totalGeneral: 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: inventaireId
        ? `Inventaire #${inventaireId} remis à zéro`
        : 'Tous les stocks remis à zéro',
    });
  } catch (error) {
    console.error('Erreur reset:', error);
    return NextResponse.json({ error: 'Erreur serveur lors du reset' }, { status: 500 });
  }
}