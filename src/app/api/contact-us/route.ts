import { NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'
import { PrismaClient } from '@prisma/client'
import { getConfirmationEmailTemplate, getReceivedEmailTemplate } from '@/app/emails/emailTemplate'

const prisma = new PrismaClient()

if (!process.env.SENDGRID_API_KEY) {
  throw new Error('SENDGRID_API_KEY must be set in environment variables')
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.dynamicstudio.us',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(req: Request) {
  try {
    let body
    try {
      body = await req.json()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400, headers: corsHeaders }
      )
    }

    const { fullName, email, phone, comments } = body

    const contactUsData = {
      to: "contact@dynamicstudio.us",
      from: `${ process.env.EMAIL_NOREPLY }`,
      replyTo: email,
      subject: `New contact message from ${ fullName }`,
      text: `
        Full Name: ${fullName}
        Email: ${email}
        Phone: ${phone}
        Comments: ${comments}
      `,
      html: getReceivedEmailTemplate( fullName, email, phone, comments ),
    }

    await sgMail.send(contactUsData)

    const contactUs = await prisma.contactUs.create({
      data: { 
        fullName, 
        email, 
        phone, 
        comments 
      },
    })

    const confirmationEmail = {
      to: email,
      from: `${ process.env.EMAIL_NOREPLY }`,
      subject: 'We have received your message',
      text: `
        Hello, ${ fullName },

        Thank you for reaching out to us! We’ve received your message and will get back to you as soon as possible. If your inquiry is urgent, feel free to contact us directly through our (837) 233-6612 or contact@dynamicstudio.us

        Best regards,
        Dynamic Studio Team
      `,
      html: getConfirmationEmailTemplate( fullName ),
    }

    await sgMail.send(confirmationEmail)

    return NextResponse.json({ 
      success: true, 
      contactUs,
      message: 'Message sent successfully'
    }, { 
      headers: corsHeaders 
    })

  } catch (error) {
    console.error('Error processing request:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { 
        status: 500, 
        headers: corsHeaders 
      }
    )
  } finally {
    await prisma.$disconnect()
  }
}