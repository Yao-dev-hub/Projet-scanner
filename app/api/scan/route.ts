/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { barcode: rawBarcode } = body;

    // Nettoyage agressif du barcode
    const barcode = rawBarcode?.trim()?.replace(/[^0-9]/g, '');

    if (!barcode || barcode.length < 15) {
      return NextResponse.json({ error: 'Code-barres invalide (minimum 15 chiffres)' }, { status: 400 });
    }


    console.log('Scan reçu :', { barcode });

    // 1. Appel api
    
    // const produit = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/produit?barcode=${barcode}`);

    // if (!produit.ok) {
    //   const errorData = await produit.json();
    //   return NextResponse.json({ error: errorData.error || 'Produit non trouvé' }, { status: 404 });
    // }

    // const produitData: {
    //   model: string;
    //   capacity: string;
    //   color: string;
    // } = await produit.json();

    if (!produitData) {
      return NextResponse.json(
        { error: "Cet appareil n'est pas dans notre base de données" },
        { status: 404 }
      );
    }   

    return NextResponse.json({
      success: true,
      produit: produitData
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