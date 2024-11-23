import { NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Verificar que tengamos la API key
if (!process.env.SENDGRID_API_KEY) {
  throw new Error('SENDGRID_API_KEY must be set in environment variables');
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Configuración de CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:4321', // URL de tu app Astro
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400', // 24 horas
};

// Manejador de OPTIONS para CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    // Validar que el body sea JSON válido
    let body;
    try {
      body = await req.json();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { fullName, email, phone, comments } = body;

    // Validar campos requeridos
    if (!fullName || !email || !phone || !comments) {
      const missingFields = [];
      if (!fullName) missingFields.push('fullName');
      if (!email) missingFields.push('email');
      if (!phone) missingFields.push('phone');
      if (!comments) missingFields.push('comments');

      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields', 
          missingFields 
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Configurar el correo
    const contactUsData = {
      to: 'noreply@dynamicstudio.us',
      from: 'noreply@dynamicstudio.us',
      replyTo: email,
      subject: `Nuevo mensaje de contacto de ${fullName}`,
      text: `
        Nombre: ${fullName}
        Email: ${email}
        Teléfono: ${phone}
        Mensaje: ${comments}
      `,
      html: `
        <h1>Nuevo mensaje de contacto</h1>
        <p><strong>Nombre:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Teléfono:</strong> ${phone}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${comments}</p>
      `,
    };

    // Enviar el correo
    await sgMail.send(contactUsData);

    // Guardar en la base de datos
    const contactUs = await prisma.contactUs.create({
      data: { 
        fullName, 
        email, 
        phone, 
        comments 
      },
    });

    // Enviar confirmación al usuario
    const confirmationEmail = {
      to: email,
      from: 'noreply@dynamicstudio.us',
      subject: 'Hemos recibido tu mensaje',
      text: `
        Hola ${fullName},

        Gracias por contactarnos. Hemos recibido tu mensaje y nos pondremos en contacto contigo pronto.

        Saludos,
        El equipo de Dynamic Studio
      `,
      html: `
        <h1>Gracias por contactarnos</h1>
        <p>Hola ${fullName},</p>
        <p>Hemos recibido tu mensaje y nos pondremos en contacto contigo pronto.</p>
        <br>
        <p>Saludos,</p>
        <p>El equipo de Dynamic Studio</p>
      `,
    };

    // Enviar email de confirmación
    await sgMail.send(confirmationEmail);

    return NextResponse.json({ 
      success: true, 
      contactUs,
      message: 'Mensaje enviado correctamente'
    }, { 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Error procesando solicitud:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { 
        status: 500, 
        headers: corsHeaders 
      }
    );
  } finally {
    await prisma.$disconnect();
  }
}