// app/api/inventaire/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const inventaires = await prisma.inventaire.findMany({
      select: {
        id: true,
        date: true,
        createdAt: true,
      },
    });

    // Ajouter le nb scans pour chaque inventaire
    const inventairesAvecNbScans = await Promise.all(
      inventaires.map(async (inv) => {
        const nbScans = await prisma.scan.count({
          where: { inventaireId: inv.id },
        });
        return {
          ...inv,
          nbScans,
        };
      })
    );

    return NextResponse.json({
      success: true,
      inventaires: inventairesAvecNbScans,
    });
  } catch (error) {
    console.error('Erreur liste inventaires:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Cherche le dernier inventaire créé aujourd’hui
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const lastInventaire = await prisma.inventaire.findFirst({
      where: { date: { gte: todayStart } },
      orderBy: { createdAt: 'desc' },
    });

    if (lastInventaire) {
      return NextResponse.json({
        success: true,
        id: lastInventaire.id,
        date: lastInventaire.date.toISOString(),
        message: `Inventaire #${lastInventaire.id} repris (créé aujourd’hui)`,
      });
    }

    // Création d’un nouvel inventaire
    const inventaire = await prisma.inventaire.create({
      data: {
        date: new Date(),
        totalA: 0,
        totalB: 0,
        totalGeneral: 0,
      },
    });

    return NextResponse.json({
      success: true,
      id: inventaire.id,
      date: inventaire.date.toISOString(),
      message: `Nouvel inventaire #${inventaire.id} créé`,
    });
  } catch (error) {
    console.error('Erreur création inventaire:', error);
    return NextResponse.json({ error: 'Erreur lors de la création de l’inventaire' }, { status: 500 });
  }
}