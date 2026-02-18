import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID!);

const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Table 1';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Build update fields dynamically
    const updateFields: Record<string, any> = {};

    if ('Decision' in body) {
      updateFields.Decision = body.Decision;
    }
    if ('Resolution' in body) {
      updateFields.Resolution = body.Resolution;
    }
    if ('Comments' in body) {
      updateFields.Comments = body.Comments;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updatedRecord = await base(TABLE_NAME).update(id, updateFields);

    return NextResponse.json({
      id: updatedRecord.id,
      fields: updatedRecord.fields,
    });
  } catch (error) {
    console.error('Airtable update error:', error);
    return NextResponse.json(
      { error: 'Failed to update record in Airtable' },
      { status: 500 }
    );
  }
}
