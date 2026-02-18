export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
        },
      }
    );

    if (!response.ok) throw new Error('Failed to fetch base info');

    const data = await response.json();

    return NextResponse.json({ name: data.name });
  } catch (error) {
    console.error('Airtable base fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch base info' },
      { status: 500 }
    );
  }
}
