// app/api/update-produit/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { barcode, ...data } = body;

    const updated = await prisma.produit.update({
      where: { barcode },
      data,
    });

    return NextResponse.json({ success: true, produit: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}