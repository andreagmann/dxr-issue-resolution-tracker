export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Airtable from 'airtable';

export async function GET() {
  console.log('BASE_ID:', process.env.AIRTABLE_BASE_ID);
  console.log('TABLE_NAME:', process.env.AIRTABLE_TABLE_NAME);

  const base = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY,
  }).base(process.env.AIRTABLE_BASE_ID!);

  const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Table 1';
  
  try {
    const records: any[] = [];

    await base(TABLE_NAME)
      .select({
        fields: ['Issue ID', 'Issue', 'Description', 'Screenshot', 'Dimension', 'Theme', 'Decision', 'Resolution', 'Comments'],
        filterByFormula: "NOT({Dimension} = '')",
      })
      .eachPage((pageRecords, fetchNextPage) => {
        pageRecords.forEach((record) => {
          records.push({
            id: record.id,
            fields: record.fields,
          });
        });
        fetchNextPage();
      });

    return NextResponse.json({ records });
  } catch (error) {
    console.error('Airtable fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch records from Airtable' },
      { status: 500 }
    );
  }
}
