// app/api/inventaire/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST() {
  // 1. On calcule minuit aujourd'hui (pour vérifier si un inventaire existe déjà aujourd'hui)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // 2. On cherche le dernier inventaire créé aujourd'hui
  const lastInventaire = await prisma.inventaire.findFirst({
    where: { date: { gte: todayStart } },
    orderBy: { createdAt: 'desc' },
  });

  // 3. S'il en existe un → on le reprend (on renvoie son ID)
  if (lastInventaire) {
    return NextResponse.json({
      success: true,
      id: lastInventaire.id,
      date: lastInventaire.date.toISOString(),
      message: `Inventaire #${lastInventaire.id} repris (créé aujourd’hui)`,
    });
  }

  // 4. Sinon → on en crée un nouveau avec totals à 0
  const inventaire = await prisma.inventaire.create({
    data: {
      date: new Date(),
      totalA: 0,
      totalB: 0,
      totalGeneral: 0,
    },
  });

  // 5. On renvoie l'ID du nouvel inventaire
  return NextResponse.json({
    success: true,
    id: inventaire.id,
    date: inventaire.date.toISOString(),
    message: `Nouvel inventaire #${inventaire.id} créé`,
  });
}